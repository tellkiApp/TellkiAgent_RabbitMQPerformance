//java -jar rabbitmq-monitor-performance.jar 1442 "1,1,1,1,1,1,1" 127.0.0.1 15672 "guest" "guest"

//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = ("Wrong number of parameters.");
}
InvalidParametersNumberError.prototype = Error.prototype;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = ("Invalid number of metrics.");
}
InvalidMetricStateError.prototype = Error.prototype;

function InvalidAuthenticationError() {
    this.name = "InvalidAuthenticationError";
    this.message = ("Invalid authentication.");
}
InvalidAuthenticationError.prototype = Error.prototype;

function HTTPError() {
    this.name = "HTTPError";
    this.message = "";
}
HTTPError.prototype = Error.prototype;

function UnknownHostError() {
    this.name = "UnknownHostError";
    this.message = ("Unknown host.");
}
UnknownHostError.prototype = Error.prototype;


// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		console.log(err.message);
		process.exit(1);
	}
}).call(this)



function monitorInput(args)
{
	
	if(args.length != 6)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}


function monitorInputProcess(args)
{
	var targetUUID = args[0];
	
	//metric state
	var metricState = args[1].replace("\"", "");
	
	var tokens = metricState.split(",");

	var metricsExecution = new Array(7);
	
	if (tokens.length === metricsExecution.length)
	{
		for(var i in tokens)
		{
			metricsExecution[i] = (tokens[i] === "1");
		}
	}
	else
	{
		throw new InvalidMetricStateError();
	}
	
	
	//host
	var hostname = args[2];
	
	//port
	var port = args[3];
	
	if (port.length === 0)
	{
		port = "55672";
	}
	
	
	// Username
	var username = args[4];
	username = username.length === 0 ? "" : username;
	
	// Password
	var passwd = args[5];
	passwd = passwd.length === 0 ? "" : passwd;
	
	
	if(username === '{0}')
	{
		username = passwd = "";
	}

	var requests = []
	
	var request = new Object()
	request.targetUUID = targetUUID;
	request.checkMetrics = metricsExecution;
	request.hostname = hostname;
	request.port = port;
	request.username = username;
	request.passwd = passwd;
	
	requests.push(request)

	
	monitorRabbitPerformance(requests);
	
}




//################### OUTPUT ###########################

function output(metrics, targetId)
{
	for(var i in metrics)
	{
		var out = "";
		var metric = metrics[i];
		
		out += new Date(metric.ts).toISOString();
		out += "|";
		out += metric.id;
		out += "|";
		out += targetId;
		out += "|";
		out += metric.val
		
		console.log(out);
	}
}



// ################# MONITOR ###########################
function monitorRabbitPerformance(requests) 
{

	for(var i in requests)
	{
		var request = requests[i];
		
		doRequest(request, 0, errorHandler);
		doRequest(request, 1, errorHandler);	
	}    
}

function errorHandler(err)
{
	if(err)
	{
		
		console.log(err.message);
		process.exit(1);
	}
}



function doRequest(request, type , callback)
{
	var http = require("http");
	
	var _path = "";
	
	if(type === 0)
		_path = "/api/overview";
	else
		_path = "/api/nodes";
		
	var options = {
		hostname: request.hostname,
		path: _path,
		method: "GET",
		port: request.port,
		auth: request.username + ':' + request.passwd, 
	};

	var start = Date.now();
	
	var req = http.request(options, function (res) {
		var data = '';
		
		var code = res.statusCode;
		
		if (code != 200)
		{
			if (code == 401)
			{
				callback(new InvalidAuthenticationError());
			}
			else
			{
				var exception = new HTTPError();
				exception.message = "Response error (" + code + ").";
				callback(exception);
			}
		}
		
		res.setEncoding('utf8');
		
		// On each chunk
		res.on('data', function (chunk) {
			data += chunk;
		});
		
		// On End
		res.on('end', function (res) {
			
			if(type === 0)
				parseOverview(data, request, start);
			else
				parseNodes(data, request, start);
		});
	});
	
	// On Error
	req.on('error', function (e) {
		
		if(e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED')
			callback(new UnknownHostError()); 
		else
			callback(e);
	});

	req.end();
}



function parseOverview(data, request, start)
{
	var metrics = []
	
	var overview = JSON.parse(data);
	
	// messages.total
	if (request.checkMetrics[0])
	{
		var metric = new Object();
		metric.id = '33:4';
		metric.val = overview.queue_totals.messages;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}
	

	// messages.ready
	if (request.checkMetrics[1])
	{
		var metric = new Object();
		metric.id = '177:4';
		metric.val = overview.queue_totals.messages_ready;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}

	// messages.unacknowledged
	if (request.checkMetrics[2])
	{
		var metric = new Object();
		metric.id = '46:4';
		metric.val = overview.queue_totals.messages_unacknowledged;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}

	// messages.total.rate
	if (request.checkMetrics[3])
	{
		var metric = new Object();
		metric.id = '216:4';
		metric.val = overview.queue_totals.messages_details.rate;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);

	}

	// messages.ready.rate
	if (request.checkMetrics[4])
	{
		var metric = new Object();
		metric.id = '143:4';
		metric.val = overview.queue_totals.messages_ready_details.rate;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}

	// messages.unacknowledged.rate
	if (request.checkMetrics[5])
	{
		var metric = new Object();
		metric.id = '198:4';
		metric.val = overview.queue_totals.messages_unacknowledged_details.rate;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}

	output(metrics, request.targetUUID);
}


function parseNodes(data, request, start)
{
	var nodes = JSON.parse(data);
	
	var metrics = []
	
	// memory.total
	if (request.checkMetrics[6])
	{
		var memory = parseInt(nodes[0].mem_used);
		memory = parseInt(memory / 1024 / 1024);
	
		var metric = new Object();
		metric.id = '99:4';
		metric.val = memory;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}
	
	output(metrics, request.targetUUID);
	
}

