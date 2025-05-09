const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const types = require('./mime.json');
const { Logger, ArgvParser } = require('../shared');
const logger = new Logger({
    format: msg => {
        return (
            `[${msg.timestamp}] ` +
            `${msg.level.toUpperCase()} ` +
            `${msg.event.toUpperCase()} ` +
            msg.client +
            (msg.message ? ' - ' + msg.message : '')
        );
    },
});

function startHttpCommandServer(context) {
    // A server to run a command and return the result for every request instead of retunrning a static string or file

    const { execSync } = require('child_process');
    let { host, port, dump, content, ssl, sslkey, sslcert, auth, mime } =
        context;
    let contentType = 'command: ';
    let fname = content;

    function reqhandle(req, res) {
        let date = new Date();
        let now =
            date.toString().split(' ')[4] +
            '.' +
            date.getMilliseconds().toString().padStart(3, '0');
        let [remoteip, remoteport] = [
            (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
                .split(',')
                .join('>'),
            req.socket.remotePort,
        ];

        let accepted = true;
        if (auth.use) {
            let r_header = req.headers.authorization || ''; // get the auth header
            let r_token = r_header.split(/\s+/).pop() || ''; // and the encoded auth token
            let r_auth = Buffer.from(r_token, 'base64').toString(); // convert from base64
            let r_parts = r_auth.split(/:/); // split on colon
            let r_username = r_parts.shift(); // username is first
            let r_password = r_parts.join(':'); // everything else is the password
            if (r_username !== auth.user || r_password !== auth.pass) {
                console.log(
                    `${now} - http@${remoteip}:${remoteport} >> [${
                        req.method
                    }] : ${
                        req.url == '/undefined' ? '/' : req.url
                    } - Auth:Rejected`
                );
                res.writeHead(401, {
                    'Content-Type': 'text/html',
                    'WWW-Authenticate':
                        'Basic realm="Access to the staging site"',
                });
                res.end('401: Forbidden :: Authorization Failed');
                accepted = false;
            }
            console.log(
                `${now} - http@${remoteip}:${remoteport} >> [${req.method}] : ${
                    req.url == '/undefined' ? '/' : req.url
                } - Auth:Accepted`
            );
        } else {
            console.log(
                `${now} - http@${remoteip}:${remoteport} >> [${req.method}] : ${
                    req.url == '/undefined' ? '/' : req.url
                }`
            );
        }
        if (dump)
            console.log(
                '  & ' +
                    Object.entries(req.headers)
                        .map(x => x.join(': '))
                        .join('\n  & ')
            );

        if (!accepted) return;

        let ls;
        try {
            res.writeHead(200, {
                'Content-Type': mime || 'text/plain; charset=utf-8',
            });
            ls = execSync(content);
            res.write(ls);
            res.end();
        } catch (err) {
            res.write(
                'Failure on: ' +
                    process.argv.join(' ') +
                    '\n' +
                    err.message +
                    '\n' +
                    ls?.stderr?.toString() +
                    '\n' +
                    ls?.stdout?.toString()
            );
            res.end();
        }
    }

    function listenhandle() {
        logger.print(`[+] Exposed Interface: (HTTP) ${host}:${port}`, 'yellow');
        logger.print(
            `[+] Local Link: http://` +
                (host !== '0.0.0.0' ? host : '127.0.0.1') +
                `:${port}/`,
            'yellow'
        );
        logger.print(`[+] Responding with ${content.length} bytes`, 'yellow');
        logger.print(
            `[+] Response configured to serve [${contentType}${fname}] on base path`,
            'yellow'
        );
        if (ssl)
            logger.print(
                `[+] SSL configured with key [${context.sslkeypath}] and cert [${context.sslcertpath}]`,
                'yellow'
            );
        if (auth.use)
            logger.print(
                `[+] Basic HTTP-Authorization configured with user [${auth.user}] and password [${auth.pass}]`,
                'yellow'
            );
        console.log(); // Empty line for styling
    }

    if (!ssl)
        return http.createServer(reqhandle).listen(port, host, listenhandle);
    else
        return https
            .createServer({ key: sslkey, cert: sslcert }, reqhandle)
            .listen(port, host, listenhandle);
}

function startHttpExecServer(context) {
    // An exec server is an HTTP server, that executes commands locally based on a passed URL
    const { execSync } = require('child_process');
    let { host, port, dump, content, ssl, sslkey, sslcert, auth, mime } =
        context;
    let extension = 'text/html';
    let contentType = 'text://';
    let fname = content;

    if (fs.existsSync(content)) {
        if (fs.statSync(content).isFile()) {
            contentType = 'file://';
            extension = types[path.extname(content).slice(1)] || 'text/html';
            content = fs.readFileSync(content);
        }
    }

    function reqhandle(req, res) {
        let date = new Date();
        let now =
            date.toString().split(' ')[4] +
            '.' +
            date.getMilliseconds().toString().padStart(3, '0');
        let [remoteip, remoteport] = [
            (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
                .split(',')
                .join('>'),
            req.socket.remotePort,
        ];

        let accepted = true;
        if (auth.use) {
            let r_header = req.headers.authorization || ''; // get the auth header
            let r_token = r_header.split(/\s+/).pop() || ''; // and the encoded auth token
            let r_auth = Buffer.from(r_token, 'base64').toString(); // convert from base64
            let r_parts = r_auth.split(/:/); // split on colon
            let r_username = r_parts.shift(); // username is first
            let r_password = r_parts.join(':'); // everything else is the password
            if (r_username !== auth.user || r_password !== auth.pass) {
                console.log(
                    `${now} - http@${remoteip}:${remoteport} >> [${
                        req.method
                    }] : ${
                        req.url == '/undefined' ? '/' : req.url
                    } - Auth:Rejected`
                );
                res.writeHead(401, {
                    'Content-Type': 'text/html',
                    'WWW-Authenticate':
                        'Basic realm="Access to the staging site"',
                });
                res.end('401: Forbidden :: Authorization Failed');
                accepted = false;
            }
            console.log(
                `${now} - http@${remoteip}:${remoteport} >> [${req.method}] : ${
                    req.url == '/undefined' ? '/' : req.url
                } - Auth:Accepted`
            );
        } else {
            console.log(
                `${now} - http@${remoteip}:${remoteport} >> [${req.method}] : ${
                    req.url == '/undefined' ? '/' : req.url
                }`
            );
        }
        if (dump)
            console.log(
                '  & ' +
                    Object.entries(req.headers)
                        .map(x => x.join(': '))
                        .join('\n  & ')
            );

        if (!accepted) return;

        // Prevents logging of empty commands
        if (req.url == '/' || req.url == '/favicon.ico') {
            res.writeHead(200, { 'Content-Type': mime || extension });
            res.write(content);
            res.end();
            return;
        }

        let comm = decodeURIComponent(req.url.split('').slice(1).join(''));
        comm = comm.split('/').join(' ');
        let ls;
        try {
            res.writeHead(200, {
                'Content-Type': mime || 'text/plain; charset=utf-8',
            });
            ls = execSync(comm);
            res.write(ls);
            res.end();
        } catch (err) {
            ls = err;
            res.write(JSON.stringify(ls, null, '\t'));
            res.end();
        }
    }

    function listenhandle() {
        logger.print(`[+] Exposed Interface: (HTTP) ${host}:${port}`, 'yellow');
        logger.print(
            `[+] Local Link: http://` +
                (host !== '0.0.0.0' ? host : '127.0.0.1') +
                `:${port}/`,
            'yellow'
        );
        logger.print(`[+] Responding with ${content.length} bytes`, 'yellow');
        logger.print(
            `[+] Response configured to serve [${contentType}${fname}] on base path`,
            'yellow'
        );
        if (ssl)
            logger.print(
                `[+] SSL configured with key [${context.sslkeypath}] and cert [${context.sslcertpath}]`,
                'yellow'
            );
        if (auth.use)
            logger.print(
                `[+] Basic HTTP-Authorization configured with user [${auth.user}] and password [${auth.pass}]`,
                'yellow'
            );
        logger.print(
            `[i] Access http://${host}:${port}/ and append a command to execute`,
            'cyan'
        );
        logger.print(
            `[i] Ex: http://${host}:${port}/ping%201.1.1.1 to ping the IP 1.1.1.1`,
            'cyan'
        );
        console.log(); // Empty line for styling
    }

    if (!ssl)
        return http.createServer(reqhandle).listen(port, host, listenhandle);
    else
        return https
            .createServer({ key: sslkey, cert: sslcert }, reqhandle)
            .listen(port, host, listenhandle);
}

function startHttpSiteServer(context) {
    let { host, port, dump, content, ssl, sslkey, sslcert, auth } = context;
    const root = path.normalize(path.resolve(content));

    function reqhandle(req, res) {
        let date = new Date();
        let now =
            date.toString().split(' ')[4] +
            '.' +
            date.getMilliseconds().toString().padStart(3, '0');
        let [remoteip, remoteport] = [
            (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
                .split(',')
                .join('>'),
            req.socket.remotePort,
        ];

        let accepted = true;
        if (auth.use) {
            let r_header = req.headers.authorization || ''; // get the auth header
            let r_token = r_header.split(/\s+/).pop() || ''; // and the encoded auth token
            let r_auth = Buffer.from(r_token, 'base64').toString(); // convert from base64
            let r_parts = r_auth.split(/:/); // split on colon
            let r_username = r_parts.shift(); // username is first
            let r_password = r_parts.join(':'); // everything else is the password
            if (r_username !== auth.user || r_password !== auth.pass) {
                console.log(
                    `${now} - http@${remoteip}:${remoteport} >> [${
                        req.method
                    }] : ${
                        req.url == '/undefined' ? '/' : req.url
                    } - Auth:Rejected`
                );
                res.writeHead(401, {
                    'Content-Type': 'text/html',
                    'WWW-Authenticate':
                        'Basic realm="Access to the staging site"',
                });
                res.end('401: Forbidden :: Authorization Failed');
                accepted = false;
            }
            console.log(
                `${now} - http@${remoteip}:${remoteport} >> [${req.method}] : ${
                    req.url == '/undefined' ? '/' : req.url
                } - Auth:Accepted`
            );
        } else {
            console.log(
                `${now} - http@${remoteip}:${remoteport} >> [${req.method}] : ${
                    req.url == '/undefined' ? '/' : req.url
                }`
            );
        }
        if (dump)
            console.log(
                '  & ' +
                    Object.entries(req.headers)
                        .map(x => x.join(': '))
                        .join('\n  & ')
            );

        if (!accepted) return;

        let extension = path.extname(req.url).slice(1);
        let type = extension
            ? types[extension]
                ? types[extension]
                : types.txt
            : types.txt;

        let fileName = req.url;
        if (req.url === '/') {
            fileName = 'index.html';
            type = 'text/html';
        } else if (!extension) {
            try {
                fs.accessSync(
                    path.join(root, req.url + '.html'),
                    fs.constants.F_OK
                );
                fileName = req.url + '.html';
            } catch {
                fileName = path.join(req.url, 'index.html');
            }
        }

        const filePath = path.join(root, fileName);
        const isPathUnderRoot = path
            .normalize(path.resolve(filePath))
            .startsWith(root);

        if (!isPathUnderRoot) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('404: File not found');
            return;
        }

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('404: File not found');
            } else {
                res.writeHead(200, { 'Content-Type': type });
                res.write(data);
                res.end();
            }
        });
    }

    function listenhandle() {
        logger.print(`[+] Exposed Interface: (HTTP) ${host}:${port}`, 'yellow');
        logger.print(
            `[+] Local Link: http://` +
                (host !== '0.0.0.0' ? host : '127.0.0.1') +
                `:${port}/`,
            'yellow'
        );
        logger.print(`[+] Responding with ${content.length} bytes`, 'yellow');
        logger.print(
            `[+] Response configured to serve [${content}] on base path`,
            'yellow'
        );
        if (ssl)
            logger.print(
                `[+] SSL configured with key [${context.sslkeypath}] and cert [${context.sslcertpath}]`,
                'yellow'
            );
        if (auth.use)
            logger.print(
                `[+] Basic HTTP-Authorization configured with user [${auth.user}] and password [${auth.pass}]`,
                'yellow'
            );
        console.log(); // Empty line for styling
    }

    if (!ssl)
        return http.createServer(reqhandle).listen(port, host, listenhandle);
    else
        return https
            .createServer({ key: sslkey, cert: sslcert }, reqhandle)
            .listen(port, host, listenhandle);
}

function startHttpBaseServer(context) {
    let { host, port, dump, content, ssl, sslkey, sslcert, auth, mime } =
        context;
    let extension = 'text/html';
    let fname = content;
    let contentType = 'text://';

    if (fs.existsSync(content)) {
        if (fs.statSync(content).isFile()) {
            contentType = 'file://';
            extension = types[path.extname(content).slice(1)] || 'text/html';
            content = fs.readFileSync(content);
        }
    }

    function reqhandle(req, res) {
        let date = new Date();
        let now =
            date.toString().split(' ')[4] +
            '.' +
            date.getMilliseconds().toString().padStart(3, '0');
        let [remoteip, remoteport] = [
            (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
                .split(',')
                .join('>'),
            req.socket.remotePort,
        ];

        let accepted = true;
        if (auth.use) {
            let r_header = req.headers.authorization || ''; // get the auth header
            let r_token = r_header.split(/\s+/).pop() || ''; // and the encoded auth token
            let r_auth = Buffer.from(r_token, 'base64').toString(); // convert from base64
            let r_parts = r_auth.split(/:/); // split on colon
            let r_username = r_parts.shift(); // username is first
            let r_password = r_parts.join(':'); // everything else is the password
            if (r_username !== auth.user || r_password !== auth.pass) {
                console.log(
                    `${now} - http@${remoteip}:${remoteport} >> [${
                        req.method
                    }] : ${
                        req.url == '/undefined' ? '/' : req.url
                    } - Auth:Rejected`
                );
                res.writeHead(401, {
                    'Content-Type': 'text/html',
                    'WWW-Authenticate':
                        'Basic realm="Access to the staging site"',
                });
                res.end('401: Forbidden :: Authorization Failed');
                accepted = false;
            } else {
                console.log(
                    `${now} - http@${remoteip}:${remoteport} >> [${
                        req.method
                    }] : ${
                        req.url == '/undefined' ? '/' : req.url
                    } - Auth:Accepted`
                );
            }
        } else {
            console.log(
                `${now} - http@${remoteip}:${remoteport} >> [${req.method}] : ${
                    req.url == '/undefined' ? '/' : req.url
                }`
            );
        }
        if (dump)
            console.log(
                '  & ' +
                    Object.entries(req.headers)
                        .map(x => x.join(': '))
                        .join('\n  & ')
            );

        if (!accepted) return;

        if (req.method.toUpperCase().trim() == 'POST') {
            let chunkdata = '';
            req.on('data', function (chunk) {
                chunkdata += chunk;
            });
            req.on('end', function () {
                let date = new Date();
                let now =
                    date.toString().split(' ')[4] +
                    '.' +
                    date.getMilliseconds().toString().padStart(3, '0');
                let [remoteip, remoteport] = [
                    (
                        req.headers['x-forwarded-for'] ||
                        req.socket.remoteAddress ||
                        ''
                    )
                        .split(',')
                        .join('>'),
                    req.socket.remotePort,
                ];
                console.log(
                    `${now} - http@${remoteip}:${remoteport} >> [${
                        req.method
                    }] : ${
                        req.url == '/undefined' ? '/' : req.url
                    } - ${chunkdata}`
                );
                res.writeHead(200, { 'Content-Type': mime || extension });
                res.write(content);
                res.end();
            });
        } else {
            res.writeHead(200, { 'Content-Type': mime || extension });
            res.write(content);
            res.end();
        }
    }

    function listenhandle() {
        logger.print(`[+] Exposed Interface: (HTTP) ${host}:${port}`, 'yellow');
        logger.print(
            `[+] Local Link: http://` +
                (host !== '0.0.0.0' ? host : '127.0.0.1') +
                `:${port}/`,
            'yellow'
        );
        logger.print(`[+] Responding with ${content.length} bytes`, 'yellow');
        logger.print(
            `[+] Response configured to serve [${contentType}${fname}] on base path`,
            'yellow'
        );
        if (ssl)
            logger.print(
                `[+] SSL configured with key [${context.sslkeypath}] and cert [${context.sslcertpath}]`,
                'yellow'
            );
        if (auth.use)
            logger.print(
                `[+] Basic HTTP-Authorization configured with user [${auth.user}] and password [${auth.pass}]`,
                'yellow'
            );
        console.log(); // Empty line for styling
    }

    if (!ssl)
        return http.createServer(reqhandle).listen(port, host, listenhandle);
    else
        return https
            .createServer({ key: sslkey, cert: sslcert }, reqhandle)
            .listen(port, host, listenhandle);
}

function startHttpFileServer(context) {
    let { host, port, dump, content, ssl, sslkey, sslcert, auth } = context;
    const basepath = path.resolve(content); // ./www -> C:\var\www

    const normalizeURLPath = filepath => decodeURIComponent(filepath);
    // Sets all '\\' to '/' : D:\Users -> D:/Users
    const normalizePath = filepath => filepath.replaceAll('\\', '/');
    // Gets the last fragment of path: D:\Users\Temp -> Temp
    const pathFragment = (filepath, position) => {
        filepath = filepath.replaceAll('\\', '/').split('/');
        return filepath[position || filepath.length - 1];
    };
    // Slices and normalizes the path starting from the first occurence of a fragment:
    // slicePath('D:\\Users\\Temp\\files\\test', 'D:\\Users\\Temp') -> '/files/test'
    const slicePath = (filepath, fragment) => {
        filepath = normalizePath(filepath);
        fragment = normalizePath(fragment);
        return filepath.replace(fragment, '');
    };

    async function reqhandle(req, res) {
        let date = new Date();
        let now =
            date.toString().split(' ')[4] +
            '.' +
            date.getMilliseconds().toString().padStart(3, '0');
        let [remoteip, remoteport] = [
            (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
                .split(',')
                .join('>'),
            req.socket.remotePort,
        ];

        let accepted = true;
        if (auth.use) {
            let r_header = req.headers.authorization || ''; // get the auth header
            let r_token = r_header.split(/\s+/).pop() || ''; // and the encoded auth token
            let r_auth = Buffer.from(r_token, 'base64').toString(); // convert from base64
            let r_parts = r_auth.split(/:/); // split on colon
            let r_username = r_parts.shift(); // username is first
            let r_password = r_parts.join(':'); // everything else is the password
            if (r_username !== auth.user || r_password !== auth.pass) {
                console.log(
                    `${now} - http@${remoteip}:${remoteport} >> [${
                        req.method
                    }] : ${
                        req.url == '/undefined' ? '/' : req.url
                    } - Auth:Rejected`
                );
                res.writeHead(401, {
                    'Content-Type': 'text/html',
                    'WWW-Authenticate':
                        'Basic realm="Access to the staging site"',
                });
                res.end('401: Forbidden :: Authorization Failed');
                accepted = false;
            }
            console.log(
                `${now} - http@${remoteip}:${remoteport} >> [${req.method}] : ${
                    req.url == '/undefined' ? '/' : req.url
                } - Auth:Accepted`
            );
        } else {
            console.log(
                `${now} - http@${remoteip}:${remoteport} >> [${req.method}] : ${
                    req.url == '/undefined' ? '/' : req.url
                }`
            );
        }
        if (dump)
            console.log(
                '  & ' +
                    Object.entries(req.headers)
                        .map(x => x.join(': '))
                        .join('\n  & ')
            );

        if (!accepted) return;

        const querypath = normalizeURLPath(req.url.slice(1)); // /deb/test/file.txt -> deb/test/file.txt
        const referencePath = path.join(basepath, querypath); // C:\var\www + deb/test/file.txt -> C:\var\www\deb\test\file.txt

        function getFiles(source) {
            return fs
                .readdirSync(source, { withFileTypes: true })
                .filter(x => x.isDirectory() || x.isFile())
                .map(x => {
                    let fname = path.join(source, x.name);
                    let flink = slicePath(
                        path.join(
                            source,
                            encodeURIComponent(pathFragment(fname))
                        ),
                        basepath
                    );

                    let stat = fs.statSync(fname);
                    let fsize = stat.isDirectory()
                        ? '-'
                        : (stat.size / 1024).toFixed(2).toString() + 'K';
                    let ftime = stat.mtime.toISOString();
                    ftime = ftime
                        .slice(0, ftime.indexOf('Z') - 7)
                        .split('T')
                        .join(' ');
                    let fmime =
                        fsize == '-'
                            ? 'Directory'
                            : types[fname.slice(fname.lastIndexOf('.') + 1)] ||
                              types['default'];
                    return {
                        flink: flink,
                        name: fname,
                        size: fsize,
                        mtime: ftime,
                        mime: fmime,
                    };
                });
        }
        function formatFileListAsHTML(list) {
            const buildLine = (flink, fname, ftime, fsize, fmime) => {
                return `<tr><td align="left"><a href="${flink}"> ${pathFragment(
                    fname
                )}${
                    fsize == '-' ? '/' : ''
                } </a></td><td align="left">&nbsp;&nbsp; ${ftime} &nbsp;&nbsp;</td><td align="right">&nbsp;&nbsp; ${fsize} &nbsp;&nbsp;</td><td align="left">&nbsp;&nbsp; ${fmime} &nbsp;&nbsp;</td></tr>`;
            };
            const bodytemplate = `
            <html>
                <head>
                    <meta name="color-scheme" content="light dark">
                    <meta charset="UTF-8">
                    <title>Index of ${req.url}</title>
                    <style> * { font-family: monospace; } </style>
                </head>
                <body>
                    <h1>Index of ${req.url}</h1>
                    <table>
                        <tbody>
                        <tr>
                            <th align="left"><a>Name:</a></th>
                            <th align="left">&nbsp;&nbsp; <a>Last Modified:</a></th>
                            <th align="left">&nbsp;&nbsp; <a>Size:</a></th>
                            <th align="left">&nbsp;&nbsp; <a>Type:</a></th>
                        </tr>
                        <tr><th colspan="5"><hr></th></tr>
                            <tr><td><a href="/${req.url
                                .slice(
                                    0,
                                    req.url.lastIndexOf('/') > 0
                                        ? req.url.lastIndexOf('/')
                                        : 1
                                )
                                .slice(
                                    1
                                )}">Parent Directory</a></td><td>&nbsp;</td><td align="left"></td><td>&nbsp;</td></tr>
                            <tr><th colspan="5"><hr></th></tr>
                        {{LINES}}
                        </tbody>
                    </table>
                </body>
            </html>`;

            let dirlist = list.filter(x => x.size == '-').sort();
            let filelist = list.filter(x => x.size != '-').sort();

            return bodytemplate.replace(
                '{{LINES}}',
                [...dirlist, ...filelist]
                    .map(x =>
                        buildLine(
                            x.flink,
                            slicePath(x.name, basepath),
                            x.mtime,
                            x.size,
                            x.mime
                        )
                    )
                    .join('')
            );
        }

        if (fs.existsSync(referencePath)) {
            let stat = fs.statSync(referencePath);
            if (stat.isDirectory()) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(formatFileListAsHTML(getFiles(referencePath)));
            } else if (stat.isFile()) {
                let extension =
                    types[path.extname(referencePath).slice(1)] ||
                    types['default'];
                // For videos and audios, there may be a range being used, instead of a
                // continuous stream. In this case we need to handle slices of data
                // Unless the file is under 1mb, in this case we send it entirely
                if (req.headers['range'] && stat.size >= 1024 * 1024) {
                    const range = parseRange(req.headers['range'], stat.size);
                    res.writeHead(206, {
                        'Content-Type': extension, // + '; charset=UTF-8',
                        'Accept-Ranges': 'bytes',
                        'Content-Length': range.size,
                        'Content-Range':
                            'bytes ' +
                            range.start +
                            '-' +
                            range.end +
                            '/' +
                            stat.size,
                    });
                    const buffer = Buffer.alloc(range.size);
                    const fd = fs.openSync(referencePath);
                    fs.readSync(fd, buffer, 0, range.size, range.start);
                    console.log(
                        `[+] Sent [${buffer.length}] bytes, with MIME "${extension}". Ranging from ${range.start} to ${range.end}. Out of ${stat.size}.`
                    );
                    res.end(buffer);
                } else {
                    res.writeHead(200, {
                        'Content-Type': extension, // + '; charset=UTF-8',
                    });
                    const stream = fs.createReadStream(referencePath);
                    stream.pipe(res);
                }
            } else {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('404: File not found');
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('404: File not found');
        }
    }

    function listenhandle() {
        logger.print(`[+] Exposed Interface: (HTTP) ${host}:${port}`, 'yellow');
        logger.print(
            `[+] Local Link: http://` +
                (host !== '0.0.0.0' ? host : '127.0.0.1') +
                `:${port}/`,
            'yellow'
        );
        logger.print(`[+] Responding with ${content.length} bytes`, 'yellow');
        logger.print(
            `[+] Response configured to serve [${basepath}]`,
            'yellow'
        );
        if (ssl)
            logger.print(
                `[+] SSL configured with key [${context.sslkeypath}] and cert [${context.sslcertpath}]`,
                'yellow'
            );
        if (auth.use)
            logger.print(
                `[+] Basic HTTP-Authorization configured with user [${auth.user}] and password [${auth.pass}]`,
                'yellow'
            );
        console.log(); // Empty line for styling
    }

    if (!ssl)
        return http.createServer(reqhandle).listen(port, host, listenhandle);
    else
        return https
            .createServer({ key: sslkey, cert: sslcert }, reqhandle)
            .listen(port, host, listenhandle);
}

function startHttpRedirectionServer(context) {
    let { host, port, dump, content, ssl, sslkey, sslcert, auth } = context;

    function reqhandle(req, res) {
        let date = new Date();
        let now =
            date.toString().split(' ')[4] +
            '.' +
            date.getMilliseconds().toString().padStart(3, '0');
        let [remoteip, remoteport] = [
            (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
                .split(',')
                .join('>'),
            req.socket.remotePort,
        ];

        res.setHeader('Content-Type', 'text/html');

        let accepted = true;
        if (auth.use) {
            let r_header = req.headers.authorization || ''; // get the auth header
            let r_token = r_header.split(/\s+/).pop() || ''; // and the encoded auth token
            let r_auth = Buffer.from(r_token, 'base64').toString(); // convert from base64
            let r_parts = r_auth.split(/:/); // split on colon
            let r_username = r_parts.shift(); // username is first
            let r_password = r_parts.join(':'); // everything else is the password
            if (r_username !== auth.user || r_password !== auth.pass) {
                console.log(
                    `${now} - http@${remoteip}:${remoteport} >> [${
                        req.method
                    }] : ${
                        req.url == '/undefined' ? '/' : req.url
                    } - Auth:Rejected`
                );
                res.writeHead(401, {
                    'WWW-Authenticate':
                        'Basic realm="Access to the staging site"',
                });
                res.end('401: Forbidden :: Authorization Failed');
                accepted = false;
            }
            console.log(
                `${now} - http@${remoteip}:${remoteport} >> [${req.method}] : ${
                    req.url == '/undefined' ? '/' : req.url
                } - Auth:Accepted`
            );
        } else {
            console.log(
                `${now} - http@${remoteip}:${remoteport} >> [${req.method}] : ${
                    req.url == '/undefined' ? '/' : req.url
                }`
            );
        }
        if (dump)
            console.log(
                '  & ' +
                    Object.entries(req.headers)
                        .map(x => x.join(': '))
                        .join('\n  & ')
            );

        if (!accepted) return;

        if (req.method.toUpperCase().trim() == 'POST') {
            let chunkdata = '';
            req.on('data', function (chunk) {
                chunkdata += chunk;
            });
            req.on('end', function () {
                let date = new Date();
                let now =
                    date.toString().split(' ')[4] +
                    '.' +
                    date.getMilliseconds().toString().padStart(3, '0');
                let [remoteip, remoteport] = [
                    (
                        req.headers['x-forwarded-for'] ||
                        req.socket.remoteAddress ||
                        ''
                    )
                        .split(',')
                        .join('>'),
                    req.socket.remotePort,
                ];
                console.log(
                    `${now} - http@${remoteip}:${remoteport} >> [${
                        req.method
                    }] : ${
                        req.url == '/undefined' ? '/' : req.url
                    } - ${chunkdata}`
                );

                res.setHeader('Location', content);
                res.writeHead(302);
                res.end();
            });
        } else {
            res.setHeader('Location', content);
            res.writeHead(302);
            res.end();
        }
    }

    function listenhandle() {
        logger.print(`[+] Exposed Interface: (HTTP) ${host}:${port}`, 'yellow');
        logger.print(
            `[+] Local Link: http://` +
                (host !== '0.0.0.0' ? host : '127.0.0.1') +
                `:${port}/`,
            'yellow'
        );
        logger.print(`[+] Responding with ${content.length} bytes`, 'yellow');
        logger.print(
            `[+] Response configured to redirect to [${content}]`,
            'yellow'
        );
        if (ssl)
            logger.print(
                `[+] SSL configured with key [${context.sslkeypath}] and cert [${context.sslcertpath}]`,
                'yellow'
            );
        if (auth.use)
            logger.print(
                `[+] Basic HTTP-Authorization configured with user [${auth.user}] and password [${auth.pass}]`,
                'yellow'
            );
        console.log(); // Empty line for styling
    }

    if (!ssl)
        return http.createServer(reqhandle).listen(port, host, listenhandle);
    else
        return https
            .createServer({ key: sslkey, cert: sslcert }, reqhandle)
            .listen(port, host, listenhandle);
}

// ---- UTILS ----

function validateKeys(string = null) {
    const empty = { key: null, cert: null, keypath: null, certpath: null };
    if (!string) return empty;
    let key, cert;

    if (!string.includes(',')) {
        let dir = path.resolve(string);
        key = path.join(dir, 'key.pem');
        cert = path.join(dir, 'cert.pem');
    } else {
        [key, cert] = string.split(',');
        if (key) key = path.resolve(key);
        if (cert) cert = path.resolve(cert);
    }

    if (!fs.existsSync(key) || !fs.existsSync(cert)) return empty;
    return {
        key: fs.readFileSync(key),
        cert: fs.readFileSync(cert),
        keypath: key,
        certpath: cert,
    };
}

function generateAuthStringPair() {
    const c = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890';
    const d = c + '+-=_*&$#@!.?';
    const part1 = Array.from(
        { length: 8 },
        () => c[Math.floor(Math.random() * c.length)]
    ).join('');
    const part2 = Array.from(
        { length: 8 },
        () => d[Math.floor(Math.random() * d.length)]
    ).join('');
    return part1 + ':' + part2;
}

function parseRange(rangeHeader, fileSize) {
    let [, value] = rangeHeader.split('=');
    let [start, end] = value.split('-').map(Number);
    // If no size is specified, send a 1mb chunk
    if (end - start <= 0) end = start + 1024 * 1024;
    if (end >= fileSize) end = fileSize;
    let size = end - start;
    let ended = end === fileSize;
    return { start, end: end - 1, size, ended };
}

// function logmiddleware(req, res) {
//     logger.info(
//         { event: 'request', client },
//         `Received ${data.length} bytes` +
//             (dump ? '\n' + prettifyRawRequestData(data) : '')
//     );
//     logger.info({ event: 'response', client }, `Sent ${content.length} bytes`);
// }

// ---- UTILS ----

(function wrapper() {
    const help = `
    [server-http-js]
        A protocol-compliant HTTP/HTTPS server with multiple modes

    Usage:
        server-http <protocol> [options] [-r RESOURCE]

    Protocol:        (Port)     (Comment)               (Resource Type)
        site          80         HTTP site server        Directory     
        file          80         Static file server      Directory     
        move          80         Redirection server      Text          
        base          80         Raw HTTP server         File | Text   
        exec          8080       C2 local HTTP server    File | Text   
        comm          8000       Simple command server   Text          

    Options:
        -h, --help                  Shows this help message
        -H, --help-all              Shows a longer help message
        -v, --version               Shows version information
        -p, --port <PORT>           Selects a port to use
        -o, --host <HOST>           Selects an interface to use (default is '0.0.0.0')
        -d, --dump                  Dumps request headers for all requests in the console
        -r, --res  <RESOURCE>       Uses a specific resource as response (see table below)
        -a, --auth <USER>:<PASS>    Enables default HTTP-Auth headers
        -m, --mime <MIME-TYPE>      Uses a specific MIME type for the responses
        -s, --https <KEY>,<CERT>    Uses HTTPS instead of HTTP - require key and certificate
            --https <DIR>`;

    const fullhelp = `

        ┌───────────────────────────────────────────────────────────────────┐
        │         Default ports and possible options by protocol            │
        ├───────────────────────────────────────────────────────────────────┤
        │  Protocol:     Port:      Comment:                Resource Type:  │
        ├───────────────────────────────────────────────────────────────────┤
        │  site          80         HTTP site server        Directory       │
        │  file          80         Static file server      Directory       │
        │  move          80         Redirection server      URL             │
        │  base          80         Raw HTTP server         File | Text     │
        │  exec          8080       C2 local HTTP server    File | Text     │
        │  comm          8000       Simple command server   Text            │
        └───────────────────────────────────────────────────────────────────┘

    Info:
        > When using 'move' protocol (redirection server), you must provide an url for redirection.
          EX:   server-http move -r "www.bing.com"
          (The default for the resource URL is "www.google.com")

        > When using 'comm' protocol (command server), you must provide aa valid shell command.
          That command will be executed for every request, and will return its output as response.
          This is useful for reading a file that grows (logs for example) using a command like: "tail some.log".

        > When using '--auth' option, the server provides an http-auth header, forcing 
          the user to input login and password, or an 'Authorization' header must be sent.
          Pass the correct credentials as a ':' divided string:
          EX:   [...] --auth username:password
          It is also possible to pass in '*' for '--auth' parameter, to use a random user+pass combination:
          EX:   [...] --auth *      (will result in something like: X23RBCl1!6 and qXYFmz&QEy)

        > When using '--https' option, a key/certificate set, or a directory, must be passed.
          The order is 'KEY,CERT'. If a directory is provided it will look for 'key.pem' 
          and 'cert.pem' inside it.
          EX:   [...] --https ./keys/key.pem,./keys/cert.pem     (Using individual paths)
          EX:   [...] --https ./keys                             (Using a directory)
    `;

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('help-all', { alias: 'H', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('port', { alias: 'p' });
    parser.option('host', { alias: 'o' });
    parser.option('dump', { alias: 'd', allowValue: false });
    parser.option('res', { alias: 'r' });
    parser.option('auth', { alias: 'a' });
    parser.option('mime', { alias: 'm' });
    parser.option('https', { alias: 's' });
    parser.argument('protocol');
    const args = parser.parseArgv();

    const context = {
        host: '0.0.0.0',
        protocol: (args.protocol || '').toLowerCase(),
        auth: { user: null, pass: null, use: false },
        port: null,
        content: null,
        dump: false,
        ssl: false,
        sslkey: null,
        sslcert: null,
        sslkeypath: null,
        sslcertpath: null,
        mime: null,
    };

    if (!args.protocol || args.help) return console.log(help);
    if (args['help-all']) return console.log(help, '\n', fullhelp);
    if (args.version) console.log(require('./package.json')?.version);
    if (args.host) context.host = args.host;
    if (args.port) context.port = args.port;
    if (args.dump) context.dump = true;
    if (args.res) context.content = args.res;
    if (args.mime) context.mime = args.mime;
    if (args.auth) {
        let temp = args.auth;
        if (args.auth == '*') temp = generateAuthStringPair();
        context.auth.user = temp.split(':')[0];
        context.auth.pass = temp.split(':')[1];
        context.auth.use = true;
    }
    if (args.https) {
        let keyobj = validateKeys(args.https);
        context.ssl = true;
        context.sslkey = keyobj.key;
        context.sslcert = keyobj.cert;
        context.sslkeypath = keyobj.keypath;
        context.sslcertpath = keyobj.certpath;
        if (
            !context.sslkey ||
            !context.sslcert ||
            !context.sslkeypath ||
            !context.sslcertpath
        ) {
            return console.log('Error: Invalid KEY/CERTIFICATE');
        }
    }

    try {
        switch (context.protocol) {
            case 'exec':
                if (!context.port) context.port = 8080;
                if (!context.content)
                    context.content = `<html><head><title>HTTP_AutoServer_Exec</title></head><body>Status: OK</body></html>`;
                startHttpExecServer(context);
                break;

            case 'site':
                if (!context.port) context.port = 80;
                if (!context.content) context.content = process.cwd();
                startHttpSiteServer(context);
                break;

            case 'base':
                if (!context.port) context.port = 80;
                if (!context.content)
                    context.content = `<html><head><title>HTTP_AutoServer_Base</title></head><body>Status: OK</body></html>`;
                startHttpBaseServer(context);
                break;

            case 'file':
                if (!context.port) context.port = 80;
                if (!context.content) context.content = process.cwd();
                startHttpFileServer(context);
                break;

            case 'move':
                if (!context.port) context.port = 80;
                if (!context.content)
                    context.content = `https://www.google.com/`;
                startHttpRedirectionServer(context);
                break;

            case 'comm':
                if (!context.port) context.port = 8000;
                if (!context.content)
                    context.content = `echo Hello From Server!`;
                startHttpCommandServer(context);
                break;

            default:
                throw new Error('INVALID PROTOCOL: ' + args[0]);
        }
    } catch (err) {
        console.log(err.message);
    }
})();
