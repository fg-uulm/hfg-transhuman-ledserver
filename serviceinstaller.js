var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name:'LEDServer',
  description: 'Provide Arduino LED access',
  script: 'C:\\Users\\transhuman\\Documents\\hfg-transhuman-ledserver\\server.js',
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
  svc.start();
});

svc.install();