exports.readCmdOptions = function() {
	var optparse = require('optparse');
	var SWITCHES = [
		['-m', '--metrics METRICS_FILE', "optional metrics JSON file (defaults to ./conf/metrics.json)"],
		['-c', '--credentials CREDENTIAL_FILE', "optional credential JSON file (defaults to ./conf/credential.json)"],
		['-n', '--names NAMES_FILE', "optional JSON file mapping AWS keys to Graphite keys (defaults to ./conf/names.json)"],
		['-g', '--graphite GRAPHITE_FILE', "optional JSON file containing Graphite server info (defaults to ./conf/graphite.json)"],
		['-H', '--help', "Shows this help section"],
	];
	var parser = new optparse.OptionParser(SWITCHES);
	parser.banner = 'Usage: '+process.argv[1]+' [options]';
	var options = {
		metrics_file: __dirname + "/../conf/metrics.json",
		credentials_file: __dirname + "/../conf/credentials.json",
    names_file: __dirname + "/../conf/names.json",
    graphite_file: __dirname + "/../conf/graphite.json"
	};
	parser.on('metrics', function(name, value) {
	    options.metrics_file = value;
	});
	parser.on('credentials', function(name, value) {
	    options.credentials_file = value;
	});
	parser.on('names', function(name, value) {
	    options.names_file = value;
	});
	parser.on('graphite ', function(name, value) {
	    options.graphite_file = value;
	});
	parser.on('help', function() {
	    console.log(parser.toString());
	    process.exit();
	});
	parser.parse(process.argv);
	var fs = require('fs');
	var creds_JSON = fs.readFileSync(options.credentials_file, "ascii");
	var creds = JSON.parse(creds_JSON);
	if (creds.accessKeyId == undefined || creds.accessKeyId.indexOf("REPLACE") == 0 || creds.secretAccessKey == undefined || creds.secretAccessKey.indexOf("REPLACE") == 0) {
		console.error("Error : aws credential file is missing or invalid : ./conf/credentials.json");
		process.exit();
	}
	var metrics_config_JSON = fs.readFileSync(options.metrics_file, "ascii");
	var metrics_config = JSON.parse(metrics_config_JSON);
  var names_config_JSON = fs.readFileSync(options.names_file, "ascii");
	var names_config = JSON.parse(names_config_JSON);
  var graphite_config_JSON = fs.readFileSync(options.graphite_file, "ascii");
  var graphite_config = JSON.parse(graphite_config_JSON);
	options.credentials = creds;
	options.metrics_config = metrics_config;
  options.names = names_config;
  options.graphite = graphite_config;
	return options;
};
