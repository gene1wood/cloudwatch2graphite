var dateFormat = require('dateformat');
require(__dirname + '/lib/date');
var global_options = require(__dirname + '/lib/options.js').readCmdOptions();

// TODO put graphite IP into a config file
var graphite = require('graphite');

var awssum = require('awssum');
var amazon = require('awssum-amazon');
var Imd = require('awssum-amazon-imd').Imd;
var CloudWatch = require('awssum-amazon-cloudwatch').CloudWatch;
var securityCredentials = {};

if (global_options.credentials) {
 securityCredentials = {
    accessKeyId: global_options.credentials.accessKeyId,
    secretAccessKey: global_options.credentials.secretAccessKey,
    region: global_options.metrics_config.region
  };
  sighFlowControl()
} else {
  // fetch IAM creds before going further. this lives in IMD, the
  // instance metadata.
  // TODO extract into a helper lib + upstream into awssum
  var imd = new Imd();
  imd.Get({Version: 'latest', Category: '/meta-data/iam/security-credentials/' }, function(err, data) {
    if (err) throw new Error('ERROR: Unable to obtain security credentials from IMD: ' + JSON.stringify(err));
    // example role: "identity"
    var role = data.Body;
    imd.Get({Version: 'latest', Category: '/meta-data/iam/security-credentials/' + role}, function(err, data) {
      // TODO use Q.then.then.fail instead of copy-pasted err handlers
      if (err) throw new Error('ERROR: Unable to obtain security credentials from IMD: ' + JSON.stringify(err));
      var parsed = JSON.parse(data.Body);
      securityCredentials.accessKeyId = parsed.AccessKeyId;
      securityCredentials.secretAccessKey = parsed.SecretAccessKey;
      securityCredentials.token = parsed.Token;
      // brittle method to obtain region: shave last char off of AZ.
      // example: 'us-west-2a' => 'us-west-2'.
      // no other way exists unless we insert that via chef.
      // TODO consider a less brittle approach, maybe via JSON config file?
      imd.Get({Version: 'latest', Category: '/meta-data/placement/availability-zone' }, function(err, data) {
        // TODO use Q.then.then.fail instead of copy-pasted err handlers
        if (err) throw new Error('ERROR: Unable to obtain security credentials from IMD: ' + JSON.stringify(err));
        securityCredentials.region = data.Body.substr(0, data.Body.length-1)
        sighFlowControl();
      });
    });
  });
}


function sighFlowControl() {
var cloudwatch = new CloudWatch(securityCredentials);
var interval = global_options.metrics_config.interval_minutes;
var metrics = global_options.metrics_config.metrics
for(index in metrics) {
	getOneStat(metrics[index]);
}

function getOneStat(metric) {
	var now = new Date();
	var then = (interval).minutes().ago()
	var end_time = dateFormat(now, "isoUtcDateTime");
	var start_time = dateFormat(then, "isoUtcDateTime");
  var dimensions = [];
  dimensions.push({
    Name: metric["Dimensions.member.1.Name"],
    Value: metric["Dimensions.member.1.Value"]
  });
  if (metric["Dimensions.member.2.Name"]) {
    dimensions.push({
      Name: metric["Dimensions.member.2.Name"],
      Value: metric["Dimensions.member.2.Value"]
    });
  }
	var options = {
		Namespace: metric.Namespace,
		MetricName: metric.MetricName,
		Period: '60',
		StartTime: start_time,
		EndTime: end_time,
		"Statistics": [metric["Statistics.member.1"]],
		Unit: [metric.Unit],
		Dimensions: dimensions
	}
	metric.name = (global_options.metrics_config.carbonNameSpacePrefix != undefined) ? global_options.metrics_config.carbonNameSpacePrefix + "." : "";
	metric.name += metric.Namespace.replace("/", ".");
	metric.name += "." + metric["Dimensions.member.1.Value"];
	metric.name += "." + metric.MetricName;
	if (metric["Dimensions.member.2.Value"]!==undefined) 
		metric.name += "." + metric["Dimensions.member.2.Value"];
	metric.name += "." + metric["Statistics.member.1"];
	metric.name += "." + metric.Unit;
	metric.name = metric.name.toLowerCase()

  // naively search-replace to convert AWS names to Graphite names
  global_options.names.forEach(function(item) {
    metric.name = metric.name.replace(item.aws_name, item.graphite_name)
  });
  cloudwatch.GetMetricStatistics(options, function(error, response) {
    if (error) {
      console.error("ERROR ! ",JSON.stringify(error));
    } else {
      var datapoints = response.Body.GetMetricStatisticsResponse.GetMetricStatisticsResult.Datapoints.member;
      var metricData;
      if (datapoints && datapoints.length) {
        // samples might not be sorted in chronological order
        datapoints.sort(function(m1,m2){
          var d1 = new Date(m1.Timestamp), d2 = new Date(m2.Timestamp);
          return d1 - d2
        });
        metricData = datapoints[datapoints.length - 1];
      } else if (datapoints) {
        // singleton case
        metricData = datapoints;
      }
      metric.value = metricData ? metricData[metric["Statistics.member.1"]] : 0;
      metric.ts = metricData ? parseInt(new Date().getTime(metricData.Timestamp))
                              : parseInt(new Date(new Date().toUTCString()).getTime());
      var m = {};
      m[metric.name] = metric.value;
      // TODO this is terrible. rather than have a separate queue of in-flight
      // requests, or using graphite's multiple-metrics-at-once pickle protocol,
      // we use plaintext and create/destroy a client for each individual metric, yuck.
      // since we only do a few per minute, this will work temporarily.
      // but must absolutely be fixed.
      var g = global_options.graphite;
      var client = graphite.createClient(g.protocol + '://' + g.host + ':' + g.port + '/');
      client.write(m, metric.ts, function(err) {
        if (err) console.log('ERROR! Failed to write to graphite server: ' + err);
        client.end();
      });
      console.log("%s %s %s", metric.name, metric.value, metric.ts);
      if ((metric === undefined)||(metric.value === undefined)) {
        console.dir(response);
        console.dir(response.GetMetricStatisticsResult.Datapoints.member);
        console.log("[1]")
        console.dir(response.GetMetricStatisticsResult.Datapoints.member[1]);
        console.log("length=" + response.GetMetricStatisticsResult.Datapoints.member.length);
        console.log(typeof response.GetMetricStatisticsResult.Datapoints.member);
      }
    }
  });
  }
}
