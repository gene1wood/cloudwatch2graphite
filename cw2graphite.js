var dateFormat = require('dateformat');
require('./lib/date');
var global_options = require('./lib/options.js').readCmdOptions();

// TODO put graphite IP into a config file
var graphite = require('graphite').createClient('plaintext://10.148.25.134:2003/');
var awssum = require('awssum');
var amazon = require('awssum-amazon');
var CloudWatch = require('awssum-amazon-cloudwatch').CloudWatch;
var cloudwatch = new CloudWatch({
    'accessKeyId'     : global_options.credentials.accessKeyId,
    'secretAccessKey' : global_options.credentials.secretAccessKey,
    'region'          : global_options.metrics_config.region
});

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

	cloudwatch.GetMetricStatistics(options, function(error, response) {
		if(error) {
			console.error("ERROR ! ",JSON.stringify(error));

		} else {


			var memberObject = response.Body.GetMetricStatisticsResponse.GetMetricStatisticsResult.Datapoints.member;
			if (memberObject != undefined) {

				var memberObj;
				if(memberObject.length === undefined) {
					memberObj = memberObject; 
				} else {
					// samples might not be sorted in chronological order
					memberObject.sort(function(m1,m2){
						var d1 = new Date(m1.Timestamp), d2 = new Date(m2.Timestamp);
						return d1 - d2
					});
					memberObj = memberObject[memberObject.length - 1];
				}

				metric.value = memberObj[metric["Statistics.member.1"]]
				metric.ts = parseInt(new Date().getTime(memberObj.TimeStamp) / 1000);

        var m = {};
        m[metric.name] = metric.value;
        // graphite package generates timestamp for you I think
        graphite.write(m)
				
				console.log("%s %s %s", metric.name, metric.value, metric.ts);

				if ((metric === undefined)||(metric.value === undefined)) {
					console.dir(response);
					console.dir(response.GetMetricStatisticsResult.Datapoints.member);
					console.log("[1]")
					console.dir(response.GetMetricStatisticsResult.Datapoints.member[1]);
					console.log("length=" + response.GetMetricStatisticsResult.Datapoints.member.length);

					console.log(typeof response.GetMetricStatisticsResult.Datapoints.member);

				}
			} //if(memberObject != undefined)

		}
	});
}
