var dateFormat = require('dateformat');
require(__dirname + '/lib/date');
var global_options = require(__dirname + '/lib/options.js').readCmdOptions();

// TODO put graphite IP into a config file
var graphite = require('graphite');

var CloudWatch = require('awssum-amazon-cloudwatch').CloudWatch;
var getIAMCreds = require(__dirname + '/credentials.js');

if (global_options.credentials) {
 sighFlowControl({
    accessKeyId: global_options.credentials.accessKeyId,
    secretAccessKey: global_options.credentials.secretAccessKey,
    region: global_options.metrics_config.region
  });
} else {
  getIAMCreds(function(err, data) {
    sighFlowControl(data);
  });
}

function sighFlowControl(creds) {
var cloudwatch = new CloudWatch(creds);
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
    }
  });
  }
}
