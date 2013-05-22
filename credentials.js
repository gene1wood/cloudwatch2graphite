// if you're running inside EC2, you can use instance metadata (IMD)
// to fetch temporary credentials from IAM. This does that, and returns
// the creds in the format expected by awssum: { accessKeyId, secretAccessKey, token }.
//
// note: fetching the region is quite brittle, so you may optionally pass
// the region in as the second argument. if it's not passed in, then we'll
// shave the last char off the availability zone listed in IMD, and use that.
// if you only use one region, that's simplest anyway.
//
// before:
//     new CloudWatch({accessKeyId: 'foo', secretAccessKey: 'bar', region: 'baz'})
//
// after: 
//     var getIamCreds = require("./credentials.js");
//     getIamCreds(function(err, creds) { new CloudWatch(creds) });
// or, in single region installs,
//     getIamCreds(function(err, creds) { new CloudWatch(creds) }, 'us-west-2');
//
// TODO are we catching *all* the errors?
// TODO unit tests--maybe need a set of fake responses from awssum?
var Imd = require('awssum-amazon-imd').Imd;
module.exports = function getIamCreds(cb, region) {
  var imd = new Imd(),
    creds = {};
  imd.Get({Version: 'latest', Category: '/meta-data/iam/security-credentials/' }, function(err, data) {
    if (err) return cb(err);
    var role = data.Body;
    imd.Get({Version: 'latest', Category: '/meta-data/iam/security-credentials/' + role}, function(err, data) {
      if (err) return cb(err);
      var parsed = JSON.parse(data.Body);
      creds = {
        accessKeyId: parsed.AccessKeyId,
        secretAccessKey: parsed.SecretAccessKey,
        token: parsed.Token
      };
      if (region) {
        setRegion(region);
      } else {
        // brittle method to obtain region: shave last char off of AZ.
        // example: 'us-west-2a' => 'us-west-2'.
        // no other way exists unless we insert that via config mgmt.
        imd.Get({Version: 'latest', Category: '/meta-data/placement/availability-zone' }, function(err, data) {
          if (err) return cb(err); 
          var region = data.Body.substr(0, data.Body.length-1);
          setRegion(region);
        });
      }
    });
  });
  function setRegion(region) {
    creds.region = region;
    cb(null, creds);
  }
};
