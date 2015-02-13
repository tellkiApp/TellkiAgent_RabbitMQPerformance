
/*
 This script was developed by Guberni and is part of Tellki's Monitoring Solution

 February, 2015
 
 Version 1.0
 
 DESCRIPTION: Monitor RabbitMQ Performance utilization

 SYNTAX: node rabbitmq_performance_monitor.js <METRIC_STATE> <HOST> <PORT> <USER_NAME> <PASS_WORD>
 
 EXAMPLE: node rabbitmq_performance_monitor.js "1,1" "10.10.2.5" "3306" "user" "pass"

 README:
		<METRIC_STATE> is generated internally by Tellki and it's only used by Tellki default monitors.
		1 - metric is on ; 0 - metric is off
		
		<HOST> RabbitMQ ip address or hostname.
		
		<PORT> RabbitMQ port
		
		<USER_NAME> RabbitMQ user to connect
		
		<PASS_WORD> RabbitMQ user password
*/




// ############# INPUT ###################################
//START
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


/*
* Verify number of passed arguments into the script.
*/
function monitorInput(args)
{
	
	if(args.length != 5)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}


/*
* Process the passed arguments and send them to monitor execution (monitorRabbitPerformance)
* Receive: arguments to be processed
*/
function monitorInputProcess(args)
{
	//<METRIC_STATE>
	var metricState = args[0].replace("\"", "");
	
	var tokens = metricState.split(",");

	var metricsExecution = new Array(7);
	
	for(var i in tokens)
	{
		metricsExecution[i] = (tokens[i] === "1");
	}
	
	//<HOST> 
	var hostname = args[1];
	
	//<PORT> 
	var port = args[2];
	
	if (port.length === 0)
	{
		port = "15672";
	}
	
	
	// <USER_NAME> 
	var username = args[3];
	
	username = username.length === 0 ? "" : username;
	username = username === "\"\"" ? "" : username;
	if(username.length === 1 && username === "\"")
		username = "";
	
	// <PASS_WORD>
	var passwd = args[4];
	
	passwd = passwd.length === 0 ? "" : passwd;
	passwd = passwd === "\"\"" ? "" : passwd;
	if(passwd.length === 1 && passwd === "\"")
		passwd = "";
	
	
	if(username === '{0}')
	{
		username = passwd = "";
	}

	//create request object to be executed
	var requests = []
	
	var request = new Object()
	request.checkMetrics = metricsExecution;
	request.hostname = hostname;
	request.port = port;
	request.username = username;
	request.passwd = passwd;
	
	requests.push(request)

	//call monitor
	monitorRabbitPerformance(requests);
	
}


// ################# RABBITMQ PERFORMANCE ###########################
/*
* Retrieve metrics information
* Receive: object request containing configuration
*/
function monitorRabbitPerformance(requests) 
{

	for(var i in requests)
	{
		var request = requests[i];
		
		doRequest(request, 0, errorHandler);
		doRequest(request, 1, errorHandler);	
	}    
}


/*
* HTTP request to retrieve data
* Receive:
* - object request containing configuration
* - API type to request - (0 - overview; 1 - nodes)
* - callback function to execute 
*/
function doRequest(request, type , callback)
{
	var http = require("http");
	
	var _path = "";
	
	if(type === 0)
		_path = "/api/overview";
	else
		_path = "/api/nodes";
	
	// create http request options
	var options = {
		hostname: request.hostname,
		path: _path,
		method: "GET",
		port: request.port,
		auth: request.username + ':' + request.passwd, 
	};
	
	//start time to measure response time
	var start = Date.now();
	
	//do http request
	var req = http.request(options, function (res) {
		var data = '';
		
		//http response status code 
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
		
		// receive data
		res.on('data', function (chunk) {
			data += chunk;
		});
		
		// On http request end
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



//################### OUTPUT METRICS ###########################
/*
* Send metrics to console
* Receive: metrics list to output
*/
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


//################### ERROR HANDLER #########################
/*
* Used to handle errors of async functions
* Receive: Error/Exception
*/
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
	else if(err instanceof MetricNotFoundError)
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




// ##################### UTILS #####################
/*
* Parse response from api/overview
* Receive:
* - response data to process
* - object request containing configuration
* - start time, to calculate execution time
*/
function parseOverview(data, request, start)
{
	var metrics = []
	
	var overview = JSON.parse(data);
	
	// messages.total
	if (request.checkMetrics[0])
	{
		if(overview.queue_totals.messages === undefined)
		{
			var e = new MetricNotFoundError();
			e.message = "Unable to collect metric 33:Total messages:4";
			errorHandler(e);
		}
	
		var metric = new Object();
		metric.id = '33:Total messages:4';
		metric.val = overview.queue_totals.messages;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}
	
	// messages.ready
	if (request.checkMetrics[1])
	{
		if(overview.queue_totals.messages_ready === undefined)
		{
			var e = new MetricNotFoundError();
			e.message = "Unable to collect metric 177:Messages ready to delivery:4";
			errorHandler(e);
		}
		
		var metric = new Object();
		metric.id = '177:Messages ready to delivery:4';
		metric.val = overview.queue_totals.messages_ready;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}

	// messages.unacknowledged
	if (request.checkMetrics[2])
	{
		if(overview.queue_totals.messages_unacknowledged === undefined)
		{
			var e = new MetricNotFoundError();
			e.message = "Unable to collect metric 46:Messages unacknowledged:4";
			errorHandler(e);
		}
	
		var metric = new Object();
		metric.id = '46:Messages unacknowledged:4';
		metric.val = overview.queue_totals.messages_unacknowledged;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}

	// messages.total.rate
	if (request.checkMetrics[3])
	{
		if(overview.queue_totals.messages_details.rate === undefined)
		{
			var e = new MetricNotFoundError();
			e.message = "Unable to collect metric 216:Messages processed/Sec:4";
			errorHandler(e);
		}
	
		var metric = new Object();
		metric.id = '216:Messages processed/Sec:4';
		metric.val = overview.queue_totals.messages_details.rate;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);

	}

	// messages.ready.rate
	if (request.checkMetrics[4])
	{
		if(overview.queue_totals.messages_ready_details.rate === undefined)
		{
			var e = new MetricNotFoundError();
			e.message = "Unable to collect metric 143:Messages ready/Sec:4";
			errorHandler(e);
		}
	
		var metric = new Object();
		metric.id = '143:Messages ready/Sec:4';
		metric.val = overview.queue_totals.messages_ready_details.rate;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}

	// messages.unacknowledged.rate
	if (request.checkMetrics[5])
	{
		if(overview.queue_totals.messages_unacknowledged_details.rate === undefined)
		{
			var e = new MetricNotFoundError();
			e.message = "Unable to collect metric 198:Messages unacknowledged/Sec:4";
			errorHandler(e);
		}
		
		var metric = new Object();
		metric.id = '198:Messages unacknowledged/Sec:4';
		metric.val = overview.queue_totals.messages_unacknowledged_details.rate;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}

	output(metrics);
}

/*
* Parse response from api/node
* Receive:
* - response data to process
* - object request containing configuration
* - start time, to calculate execution time
*/
function parseNodes(data, request, start)
{
	var nodes = JSON.parse(data);
	
	var metrics = []
	
	// memory.total
	if (request.checkMetrics[6])
	{
		if(nodes[0].mem_used === undefined)
		{
			var e = new MetricNotFoundError();
			e.message = "Unable to collect metric 99:Total memory usage:4";
			errorHandler(e);
		}
		
		var memory = parseInt(nodes[0].mem_used);
		memory = parseInt(memory / 1024 / 1024);
	
		var metric = new Object();
		metric.id = '99:Total memory usage:4';
		metric.val = memory;
		metric.ts = start;
		metric.exec = Date.now() - start;
		
		metrics.push(metric);
	}
	
	output(metrics);
	
}



//####################### EXCEPTIONS ################################

//All exceptions used in script

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;



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


function MetricNotFoundError() {
    this.name = "MetricNotFoundError";
    this.message = "";
	this.code = 8;
}
MetricNotFoundError.prototype = Object.create(Error.prototype);
MetricNotFoundError.prototype.constructor = MetricNotFoundError;