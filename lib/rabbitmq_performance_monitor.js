
//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = "Invalid number of metrics.";
	this.code = 9;
}
InvalidMetricStateError.prototype = Object.create(Error.prototype);
InvalidMetricStateError.prototype.constructor = InvalidMetricStateError;

function InvalidAuthenticationError() {
    this.name = "InvalidAuthenticationError";
    this.message = "Invalid authentication.";
	this.code = 2;
}
InvalidAuthenticationError.prototype = Object.create(Error.prototype);
InvalidAuthenticationError.prototype.constructor = InvalidAuthenticationError;

function HTTPError() {
    this.name = "HTTPError";
    this.message = "";
	this.code = 19;
}
HTTPError.prototype = Object.create(Error.prototype);
HTTPError.prototype.constructor = HTTPError;

function UnknownHostError() {
    this.name = "UnknownHostError";
    this.message = "Unknown host.";
	this.code = 20;
}
UnknownHostError.prototype = Object.create(Error.prototype);
UnknownHostError.prototype.constructor = UnknownHostError;


// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidMetricStateError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidAuthenticationError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof HTTPError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof UnknownHostError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)



function monitorInput(args)
{
	
	if(args.length != 5)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}


function monitorInputProcess(args)
{
	//metric state
	var metricState = args[0].replace("\"", "");
	
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
	var hostname = args[1];
	
	//port
	var port = args[2];
	
	if (port.length === 0)
	{
		port = "15672";
	}
	
	
	// Username
	var username = args[3];
	
	username = username.length === 0 ? "" : username;
	username = username === "\"\"" ? "" : username;
	if(username.length === 1 && username === "\"")
		username = "";
	
	// Password
	var passwd = args[4];
	
	passwd = passwd.length === 0 ? "" : passwd;
	passwd = passwd === "\"\"" ? "" : passwd;
	if(passwd.length === 1 && passwd === "\"")
		passwd = "";
	
	
	if(username === '{0}')
	{
		username = passwd = "";
	}

	var requests = []
	
	var request = new Object()
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
		
		out += metric.id;
		out += "|";
		out += metric.val;
		out += "|";
		
		console.log(out);
	}
}


function errorHandler(err)
{
	if(err instanceof InvalidAuthenticationError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof HTTPError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof UnknownHostError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else
	{
		console.log(err.message);
		process.exit(1);
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
			else if(code === 301)
			{
				var exception = new HTTPError();
				exception.message = "Redirect detected. Please check RabbitMQ Management port configuration.";
				callback(exception);
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
		metric.id = '33:Total messages:7';
		metric.val = overview.queue_totals.messages;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}
	

	// messages.ready
	if (request.checkMetrics[1])
	{
		var metric = new Object();
		metric.id = '177:Messages ready to delivery:7';
		metric.val = overview.queue_totals.messages_ready;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}

	// messages.unacknowledged
	if (request.checkMetrics[2])
	{
		var metric = new Object();
		metric.id = '46:Messages unacknowledged:7';
		metric.val = overview.queue_totals.messages_unacknowledged;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}

	// messages.total.rate
	if (request.checkMetrics[3])
	{
		var metric = new Object();
		metric.id = '216:Messages processed/Sec:7';
		metric.val = overview.queue_totals.messages_details.rate;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);

	}

	// messages.ready.rate
	if (request.checkMetrics[4])
	{
		var metric = new Object();
		metric.id = '143:Messages ready/Sec:7';
		metric.val = overview.queue_totals.messages_ready_details.rate;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}

	// messages.unacknowledged.rate
	if (request.checkMetrics[5])
	{
		var metric = new Object();
		metric.id = '198:Messages unacknowledged/Sec:7';
		metric.val = overview.queue_totals.messages_unacknowledged_details.rate;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}

	output(metrics);
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
		metric.id = '99:Total memory usage:7';
		metric.val = memory;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}
	
	output(metrics);
	
}

