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
  function loadJsonIfExists(filename) {
    if (!fs.existsSync(filename)) { return; }
    var file_json = fs.readFileSync(filename, "ascii");
    return JSON.parse(file_json);
  }
  var creds = loadJsonIfExists(options.credentials_file);
  if (creds) options.credentials = creds;
  // we can't continue without metrics defined
  var metrics_config = loadJsonIfExists(options.metrics_file);
  if (!metrics_config) throw new Error('metrics file not found');
  options.metrics_config = metrics_config;
  // supply sensible defaults for others
  options.names = loadJsonIfExists(options.names_file) || {};
  options.graphite = loadJsonIfExists(options.graphite_file) || {'protocol': 'plaintext', 'host': '127.0.0.1', 'port': '2003'};

  return options;
};
