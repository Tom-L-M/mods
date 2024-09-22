const { createServer, createConnection } = require('net');
const { createSocket } = require('dgram');

const help = `
    [server-proxy-js]
        A tool for creating local static UDP/TCP proxy servers

    Usage:
        server-proxy [-v] [-h] [-t ipaddress:port/ipaddress:port] [-u ipaddress:port/ipaddress:port]

    Info:
        > Use '-t' or '--tcp' to declare a TCP proxy route and '-u' or '--udp' to declare a UDP proxy route
        > TCP proxy servers forward reponses back to the original client (forward/backward proxy), while
          UDP proxies do not (forward proxy only), they only transmit in one direction 
        > It is possible to pass a port range for origin port by passing 'firstport-lastport':   
            ex: 0.0.0.0:8000-9000 (directs all ports from 8000 to 9000)
        > It is possible to pass a port list for origin port by passing 'firstport,secondport':   
            ex: 0.0.0.0:8000,8001 (directs ports 8000 and 8001)

    Ex:
        server-proxy -t 192.168.15.11:8080,8081/10.3.51.13:80
        > Redirects all TCP traffic received on 192.168.15.11 at ports 8080 and 8081 to 10.3.51.13:80

        server-proxy -u 192.168.15.11:5000-5010/10.3.51.13:5000 
        > Redirects all UDP traffic received on 192.168.15.11:5000 to 192.168.15.11:5010

        server-proxy -t 192.168.15.11:8080/10.3.51.13:80 -u 192.168.15.11:5000/10.3.51.13:5000 
        > Redirects all TCP traffic received on 192.168.15.11:8080 to 10.3.51.13:80, and
          redirects all UDP traffic received on 192.168.15.11:5000 to 10.3.51.13:5000
`;

function generateRange(start, end) {
    return new Array(end - start + 1).fill(start).map((x, i) => x + i);
}

function createUdpProxy(host, port, destinationHost, destinationPort) {
    const server = createSocket('udp4');

    const log = (rinfo, msg, pipe1, pipe2) => {
        let date = new Date();
        let now =
            date.toString().split(' ')[4] +
            '.' +
            date.getMilliseconds().toString().padStart(3, '0');
        let str = `${now} UDP ${rinfo.address}:${rinfo.port} ${pipe1} ${host}:${port} ${pipe2} ${destinationHost}:${destinationPort} - ${msg}`;
        console.log(str);
        return str;
    };

    server.on('message', (msg, rinfo) => {
        log(rinfo, 'DATA_FROM_CLIENT - ' + msg.length + 'b', '>>', '||');
        server.send(msg, destinationPort, destinationHost, (err, bytes) => {
            log(rinfo, 'DATA_TO_REMOTE - ' + msg.length + 'b', '||', '>>');
            if (err)
                log(rinfo, '(ERR:ToRemoteNotFlushed) - ' + err, '||', '!!');
        });
    });

    server.on('close', () => {
        log('', 'SERVER_CLOSED', '||', '||');
    });

    server.on('error', err => {
        log('', 'ERROR_PROXY - ' + err, '!!', '!!');
    });

    server.bind(port, host, () => {
        console.log(
            `Proxy server redirecting:   <UDP>   ${host}:${port} -> ${destinationHost}:${destinationPort}`
        );
    });
}

function createTcpProxy(host, port, destinationHost, destinationPort) {
    let pipes = { a1: '??', a2: '??' };
    const server = createServer(clientSocket => {
        const log = (msg, pipe1, pipe2) => {
            let date = new Date();
            let now =
                date.toString().split(' ')[4] +
                '.' +
                date.getMilliseconds().toString().padStart(3, '0');
            let str = `${now} TCP ${clientSocket.remoteAddress}:${clientSocket.remotePort} ${pipes.a1} ${host}:${port} ${pipes.a2} ${destinationHost}:${destinationPort} - ${msg}`;
            console.log(str);
            return str;
        };

        const targetSocket = createConnection({
            host: destinationHost,
            port: destinationPort,
        });
        clientSocket.pipe(targetSocket);
        targetSocket.pipe(clientSocket);

        clientSocket.on('error', error => {
            // Errors in pipe1 (connection between client and proxy)
            log(
                'ERROR_CLIENT - ' + error,
                (pipes.a1 = '!!'),
                (pipes.a2 = '--')
            );
            targetSocket.destroy();
        });
        targetSocket.on('error', error => {
            // Errors in pipe2 (connection between proxy and remote server)
            log(
                'ERROR_REMOTE - ' + error,
                (pipes.a1 = '--'),
                (pipes.a2 = '!!')
            );
            clientSocket.destroy();
        });

        clientSocket.on('connect', function (data) {
            // Client and proxy are connected
            log('CONNECT_CLIENT', (pipes.a1 = '<>'), (pipes.a2 = '--'));
        });
        targetSocket.on('connect', function (data) {
            // Client and proxy are connected
            log('CONNECT_REMOTE', (pipes.a1 = '--'), (pipes.a2 = '<>'));
        });

        clientSocket.on('data', function (data) {
            // Proxy received data from client
            log('DATA_FROM_CLIENT', (pipes.a1 = '>>'), (pipes.a2 = '--'));
            let flushed = targetSocket.write(data);
            if (!flushed) {
                // Proxy fail to sent data to remote server
                log(
                    'PAUSE_FLUSH - (ERR:FromClientNotFlushed)',
                    (pipes.a1 = '--'),
                    (pipes.a2 = '>|')
                );
                clientSocket.pause();
            }
            log('DATA_TO_REMOTE', (pipes.a1 = '>>'), (pipes.a2 = '>>'));
        });
        targetSocket.on('data', function (data) {
            log('DATA_FROM_REMOTE', (pipes.a1 = '--'), (pipes.a2 = '<<'));
            let flushed = clientSocket.write(data);
            if (!flushed) {
                log(
                    'PAUSE_FLUSH - (ERR:FromRemoteNotFlushed)',
                    (pipes.a1 = '|<'),
                    (pipes.a2 = '--')
                );
                targetSocket.pause();
            }
            log('DATA_TO_CLIENT', (pipes.a1 = '<<'), (pipes.a2 = '<<'));
        });

        clientSocket.on('drain', function () {
            log(
                'RESUME_FLUSH - (INFO:FlushedFromClient)',
                (pipes.a1 = '--'),
                (pipes.a2 = '|>')
            );
            targetSocket.resume();
        });
        targetSocket.on('drain', function () {
            log(
                'RESUME_FLUSH - (INFO:FlushedFromRemote)',
                (pipes.a1 = '<|'),
                (pipes.a2 = '--')
            );
            log('RESUME_LOCAL', '|>', '|>');
            clientSocket.resume();
        });

        clientSocket.on('close', function (had_error) {
            log('CLOSE_CLIENT', (pipes.a1 = '><'), (pipes.a2 = '--'));
            targetSocket.end();
        });
        targetSocket.on('close', function (had_error) {
            log('CLOSE_REMOTE', (pipes.a1 = '--'), (pipes.a2 = '><'));
            clientSocket.end();
        });

        server.on('error', error => {
            log('ERROR_PROXY - ' + error, (pipes.a1 = '!!'), (pipes.a2 = '!!'));
        });
    });

    server.listen(port, host, () => {
        console.log(
            `Proxy server redirecting:   <TCP>   ${host}:${port} -> ${destinationHost}:${destinationPort}`
        );
    });
}

class Route {
    constructor(
        type = null,
        proxyip = null,
        proxyport = null,
        remoteip = null,
        remoteport = null
    ) {
        this.type = type;
        this.proxy = { ip: proxyip, port: proxyport };
        this.remote = { ip: remoteip, port: remoteport };
        this.valid =
            !!this.type &&
            !!this.proxy.ip &&
            !!this.proxy.port &&
            !!this.remote.ip &&
            !!this.remote.port;
    }
}

function parseArgs() {
    let args = process.argv.slice(2);
    if (args.length < 2) {
        console.log(help);
        process.exit(0);
    }

    let routes = [];
    let tmp;
    let proxytmp, remotetmp;
    let proxyip, proxyport, remoteip, remoteport;

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '-t':
            case '--tcp':
                i++; // skip next argument

                [proxytmp, remotetmp] = args[i].split('/');
                [proxyip, proxyport] = proxytmp.split(':');
                [remoteip, remoteport] = remotetmp.split(':');

                if (proxyport.includes(',')) {
                    for (let port of proxyport.split(',')) {
                        routes.push(
                            new Route(
                                'tcp',
                                proxyip,
                                port,
                                remoteip,
                                remoteport
                            )
                        );
                    }
                } else if (proxyport.includes('-')) {
                    tmp = proxyport.split('-').map(x => Number(x));
                    for (let port of generateRange(tmp[0], tmp[1])) {
                        routes.push(
                            new Route(
                                'tcp',
                                proxyip,
                                port,
                                remoteip,
                                remoteport
                            )
                        );
                    }
                } else {
                    routes.push(
                        new Route(
                            'tcp',
                            proxyip,
                            proxyport,
                            remoteip,
                            remoteport
                        )
                    );
                }
                break;

            case '-u':
            case '--udp':
                i++; // skip next argument

                [proxytmp, remotetmp] = args[i].split('/');
                [proxyip, proxyport] = proxytmp.split(':');
                [remoteip, remoteport] = remotetmp.split(':');

                if (proxyport.includes(',')) {
                    for (let port of proxyport.split(',')) {
                        routes.push(
                            new Route(
                                'udp',
                                proxyip,
                                port,
                                remoteip,
                                remoteport
                            )
                        );
                    }
                } else if (proxyport.includes('-')) {
                    tmp = proxyport.split('-').map(x => Number(x));
                    for (let port of generateRange(tmp[0], tmp[1])) {
                        routes.push(
                            new Route(
                                'udp',
                                proxyip,
                                port,
                                remoteip,
                                remoteport
                            )
                        );
                    }
                } else {
                    routes.push(
                        new Route(
                            'udp',
                            proxyip,
                            proxyport,
                            remoteip,
                            remoteport
                        )
                    );
                }
                break;

            default:
                console.log(`[ERROR] Invalid argument: ${args[i]}`);
                process.exit(1);
        }
    }

    if (routes.length === 0) {
        console.error(`[ERROR] Missing required arguments`);
        return [];
    }

    return routes;
}

const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

function printVersion() {
    try {
        console.log(require(exeresolve('server-proxy/package.json')).version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

(function main() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h') || args.length === 0)
        return console.log(help);
    if (args.includes('--version') || args.includes('-v'))
        return printVersion();

    const routes = parseArgs();
    for (const route of routes) {
        if (route.type === 'tcp')
            createTcpProxy(
                route.proxy.ip,
                route.proxy.port,
                route.remote.ip,
                route.remote.port
            );
        else if (route.type === 'udp')
            createUdpProxy(
                route.proxy.ip,
                route.proxy.port,
                route.remote.ip,
                route.remote.port
            );
    }
})();
