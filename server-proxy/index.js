const { createServer, createConnection } = require('net');
const { createSocket } = require('dgram');

const { Logger } = require('../shared');
const logger = new Logger({
    format: msg => {
        return (
            `[${msg.timestamp}] ` +
            msg.level.toUpperCase() +
            ' ' +
            msg.event.toUpperCase() +
            ' [(' +
            msg.protocol +
            ') ' +
            msg.host +
            '] ' +
            msg.client +
            (msg.size ? ' (' + msg.size + ' bytes)' : '') +
            (msg.message ? ' - ' + msg.message : '')
        );
    },
});

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
          redirects all UDP traffic received on 192.168.15.11:5000 to 10.3.51.13:5000`;

function generateRange(start, end) {
    return new Array(end - start + 1).fill(start).map((x, i) => x + i);
}

function prettifyRawRequestData(buffer) {
    const chunkify = (s, w) =>
        s.match(new RegExp(`.{1,${w >= 1 ? w : 1}}`, 'gim')) ?? [];
    const stringFromBuffer = [...buffer]
        .map(v => '0x' + v.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
    const chunkedString = chunkify(buffer.toString(), 16);
    const chunkedBuffer = chunkify(stringFromBuffer, 16 * 5);
    return chunkedBuffer
        .map(
            (v, i) =>
                '  ' +
                v.padEnd(16 * 5, ' ') +
                ' |' +
                (chunkedString[i] || '').padEnd(16, ' ') +
                '|'
        )
        .join('\n');
}

function createUdpProxy(host, port, destinationHost, destinationPort) {
    const server = createSocket('udp4');
    let local; // This is defined later, because it must be called AFTER the socket is binded

    server.on('message', (msg, rinfo) => {
        logger.info(
            {
                event: 'request',
                client: rinfo.address + ':' + rinfo.port,
                host: local,
                size: msg.length,
                protocol: 'udp',
            },
            `\n` + prettifyRawRequestData(msg)
        );

        const target = createSocket('udp4');
        target.on('message', targetmsg => {
            logger.info(
                {
                    event: 'response',
                    client: rinfo.address + ':' + rinfo.port,
                    host: local,
                    size: targetmsg.length,
                    protocol: 'udp',
                },
                `\n` + prettifyRawRequestData(targetmsg)
            );
            server.send(targetmsg, rinfo.port, rinfo.address);
        });
        target.send(msg, destinationPort, destinationHost, err => {
            logger.info({
                event: 'forward',
                client: destinationHost + ':' + destinationPort,
                host: local,
                size: msg.length,
                protocol: 'udp',
            });
            if (err)
                logger.error(
                    {
                        event: 'send-fail',
                        client: destinationHost + ':' + destinationPort,
                        host: local,
                        protocol: 'udp',
                    },
                    err.message
                );
        });
    });

    server.on('close', () => {
        logger.print('[-] Server Closed', 'yellow');
    });

    server.on('error', err => {
        logger.print('[x] Server Error - ' + err.message, 'red');
    });

    server.bind(port, host, () => {
        logger.print(`[+] Exposed Interface: (UDP) ${host}:${port}`, 'yellow');
        logger.print(
            `[+] Tunnel: (UDP) ${host}:${port} -> (UDP) ${destinationHost}:${destinationPort}`,
            'yellow'
        );
        logger.print(
            `[+] Local Link: udp://` +
                (this.host !== '0.0.0.0' ? host : '127.0.0.1') +
                `:${port}/\n`,
            'yellow'
        );

        local = server.address().address + ':' + server.address().port;
    });
}

function createTcpProxy(host, port, destinationHost, destinationPort) {
    const server = createServer(clientSocket => {
        const local = host + ':' + port;
        const client =
            clientSocket.address().address + ':' + clientSocket.address().port;
        const target = destinationHost + ':' + destinationPort;

        const targetSocket = createConnection({
            host: destinationHost,
            port: destinationPort,
        });
        clientSocket.pipe(targetSocket);
        targetSocket.pipe(clientSocket);

        clientSocket.on('error', error => {
            // Errors in pipe1 (connection between client and proxy)
            logger.error(
                { event: 'client-fail', client, host: local, protocol: 'tcp' },
                error.message
            );
            targetSocket.destroy();
        });
        targetSocket.on('error', error => {
            // Errors in pipe2 (connection between proxy and remote server)
            logger.error(
                {
                    event: 'forward-fail',
                    client: target,
                    host: local,
                    protocol: 'tcp',
                },
                error.message
            );
            clientSocket.destroy();
        });

        clientSocket.on('connect', function () {
            // Client and proxy are connected
            // log('CONNECT_CLIENT', (pipes.a1 = '<>'), (pipes.a2 = '--'));
        });
        targetSocket.on('connect', function () {
            // Client and proxy are connected
            // log('CONNECT_REMOTE', (pipes.a1 = '--'), (pipes.a2 = '<>'));
        });

        clientSocket.on('data', function (data) {
            // Proxy received data from client
            logger.info(
                {
                    event: 'request',
                    client,
                    host: local,
                    size: data.length,
                    protocol: 'tcp',
                },
                `\n${prettifyRawRequestData(data)}`
            );

            // let flushed = targetSocket.write(data);
            // if (!flushed) {
            //     clientSocket.pause();
            // }
        });
        targetSocket.on('data', function (data) {
            logger.info(
                {
                    event: 'response',
                    client: target,
                    host: local,
                    size: data.length,
                    protocol: 'tcp',
                },
                `\n${prettifyRawRequestData(data)}`
            );
            // let flushed = clientSocket.write(data);
            // if (!flushed) {
            //     targetSocket.pause();
            // }
        });

        // There is no point in controlling drain, if both sockets are piped to each other already

        // clientSocket.on('drain', function () {
        //     targetSocket.resume();
        // });
        // targetSocket.on('drain', function () {
        //     clientSocket.resume();
        // });

        clientSocket.on('close', function () {
            targetSocket.end();
        });
        targetSocket.on('close', function () {
            clientSocket.end();
        });
    });

    server.on('error', error => {
        logger.error(
            {
                event: 'fail',
                client: '0.0.0.0',
                host: '0.0.0.0',
                protocol: 'tcp',
            },
            error.message
        );
    });

    server.listen(port, host, () => {
        logger.print(`[+] Exposed Interface: (TCP) ${host}:${port}`, 'yellow');
        logger.print(
            `[+] Tunnel: (TCP) ${host}:${port} -> (TCP) ${destinationHost}:${destinationPort}`,
            'yellow'
        );
        logger.print(
            `[+] Local Link: tcp://` +
                (this.host !== '0.0.0.0' ? host : '127.0.0.1') +
                `:${port}/\n`,
            'yellow'
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
                logger.print(`[x] Error: Invalid argument [${args[i]}]`, 'red');
                process.exit(1);
        }
    }

    if (routes.length === 0) {
        logger.print(`[x] Error: Missing required arguments`, 'red');
        return [];
    }

    return routes;
}

(function () {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h') || args.length === 0)
        return console.log(help);
    if (args.includes('--version') || args.includes('-v'))
        return console.log(require('./package.json')?.version);

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
