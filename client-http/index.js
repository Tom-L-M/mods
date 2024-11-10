const path = require('node:path');
const fs = require('node:fs');
const { isSTDINActive, readStdinAsync } = require('../shared');

const vID = () =>
    '################'.replace(/[#]/gm, () => Math.random().toString(16)[6]);
const urlFname = url => {
    let u = new URL(url);
    return u.pathname === '/' ? vID() : u.pathname.split('/').pop();
};

const sendPacket = async context => {
    const tryCatch = (func, onerr) => {
        try {
            return func();
        } catch (err) {
            return onerr(err);
        }
    };
    const {
        url: rawurl,
        trace,
        message,
        http,
        download,
        downloadfname,
        printRedirection,
        next,
        nextSeparator,
        append,
    } = context;

    const url =
        !rawurl.startsWith('http://') && !rawurl.startsWith('https://')
            ? 'http://' + rawurl
            : rawurl;

    const _options = tryCatch(
        () => new URL(url),
        err => console.log('<> Error: ' + err.message + ' - Aborted')
    );
    if (!_options) return;

    const _proto = _options.protocol === 'https:' ? 'https' : 'http';
    const _scheme = require(_proto);

    const options = {
        method: http.method,
        hostname: _options.hostname,
        port: _options.port || undefined,
        path: _options.href.replace(_options.origin, ''),
        headers: { 'User-Agent': http.useragent },
    };

    for (let header of http.headers) {
        let [name, ...body] = header.split(':');
        options.headers['' + name] = body[0].trim();
    }

    if (message.data) {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.headers['Content-Length'] = message.size;
        ('');
    }

    let output = Buffer.from('');

    const req = _scheme.request(options, res => {
        if (trace)
            console.log(
                `> Client reached >> [${options.method}@${url}] >> StatusCode: [${res.statusCode}]`
            );
        // res.setEncoding('utf8');
        res.on('data', chunk => {
            output = Buffer.concat([output, chunk]);
        });
        res.on('end', () => {
            // Download only final '2XX' occurences (not the 3XX redirection sets)
            if (download && res.statusCode.toString().startsWith('2')) {
                let fname = path.resolve(downloadfname || urlFname(url));
                if (!append) fs.writeFileSync(fname, output);
                else
                    fs.appendFileSync(
                        fname,
                        Buffer.concat([Buffer.from(nextSeparator), output])
                    );
                if (trace)
                    console.log(
                        `> Data received (${output.length} bytes) >> StatusCode: [${res.statusCode}] - Saved as [${fname}]`
                    );
            }
            // Download only final 200 occurences (not the 3XX redirection sets)
            else {
                if (
                    res.statusCode.toString().startsWith('3') &&
                    !printRedirection
                ) {
                    if (trace)
                        console.log(
                            `> Data received (${output.length} bytes) >> StatusCode: [${res.statusCode}]`
                        );
                } else {
                    if (trace)
                        console.log(
                            `> Data received (${
                                output.length
                            } bytes) >> StatusCode: [${
                                res.statusCode
                            }] \n${output.toString('utf-8')}`
                        );
                    else {
                        if (nextSeparator) output = nextSeparator + output;
                        process.stdout.write(output.toString('utf-8'));
                    }
                }
            }
            const nexturl = next[0];
            const nextcontext = JSON.parse(JSON.stringify(context));
            if (nexturl) {
                nextcontext.url = nexturl;
                nextcontext.next = next.slice(1) || [];
                nextcontext.append = true;
                sendPacket(nextcontext);
            }
        });

        // Handle HTTP response code 3XX (redirections)
        if (!context.http.nofollow) {
            if (
                res.statusCode.toString().startsWith('3') &&
                res.headers.location
            ) {
                let c = JSON.parse(JSON.stringify(context));
                c.url = url;

                if (trace)
                    console.log(
                        '> Client informed redirection >> Redirecting to ' +
                            res.headers.location
                    );

                // provided a relative url for redirection: e.g. /something
                if (!res.headers.location.startsWith('http'))
                    c.url = new URL(c.url).origin + res.headers.location;
                // provided an absolute url for redirection: e.g. https://newplace.com/something
                else c.url = res.headers.location;

                sendPacket(c); // Send a new request to the proper place now
            }
        }
    });

    req.on('error', err => {
        if (trace)
            console.log(
                `> Could not connect >> [${options.method}@${url} - ${err.message}]`
            );
    });

    if (message.data) {
        req.write(message.data);
        if (trace) console.log(`> Data sent (${message.size} bytes)`);
    }

    req.end();
};

(async () => {
    const args = process.argv.slice(2);

    const help = `
    [client-http-js]
        A tool for sending HTTP requests for servers and services

    Usage:
        client-http <URL> [options]
       OR
        <stdin> | client-http [options]

    Options:
        -h | --help                    Prints the help message and quits.
        -v | --version                 Prints the version info and quits.
        -d | --download [FILENAME]     Downloads the response content instead of displaying it.
        -s | --trace                   Prints information about connections, data, and redirections.
        -t | --text <TEXT>             Sends a specific text as data in packet.
        -b | --bytes <BYTES>           Sends a specific series of hex bytes as data in packet.
        -f | --file <FILENAME>         Reads a file and sends its contents as data.
        -x | --method <METHOD>         Sets a request method (defaults to 'GET').
        -p | --print-redirection       Prints the response from redirections (ignored by default).
        -U | --http-useragent <AGENT>  Sets the user_agent header (defaults to Chrome standart).
        -F | --http-nofollow           Ignores 3XX-Redirection response codes.
        -H | --http-header             Sets a new HTTP header.
        -n | --next <URL>              Executes another request to URL, and concats the result after the first.
                                       Multiple --next flags may be used, and they will be requested in sequence.
        -N | --next-separator <STRING> A separator to use to divide outputs from multiple URLs queried. (defaults to '\\n').

    Info:
        It is possible to pass in multiple URLs from STDIN, by dividing them with newlines ('\\n');
        This will cause the first URL to be the main one, and the rest to be passed as "--next" arguments.
        (Spaces in beginning/end of a URL are ignored)
        E.g. The call:      echo "link1 \n link2" | client-http
        is the same as:     client-http link1 -n link2

    Example:
        Dowloading a file from catbox:
            client-http https://files.catbox.moe/AAAAAA.png -d image.png

        Querying with a link in a file and a next link:
            cat link.txt | client-http -d -n https://google.com.br/

        Querying Google with a custom useragent and special 'test' header:
            client-http https://google.com.br/ -hu MY_USER_AGENT -hh "test: something"
        
        Querying Google with a custom useragent and some data in a POST request:
            client-http https://google.com.br/ -hu MY_USER_AGENT -x POST -t "some text"`;

    if (
        args[0] == '--help' ||
        args[0] == '-h' ||
        (args.length == 0 && !isSTDINActive())
    )
        return console.log(help);

    if (args.includes('-v') || args.includes('--version'))
        return console.log(require('./package.json')?.version);

    // If multiple URLs are passed in a file, split them on '\n' and use the first as default url,
    // and the rest as '--next' parameters
    let dataFromStdin = [];
    if (isSTDINActive()) {
        dataFromStdin = (await readStdinAsync()).toString('utf-8').trim();
        if (dataFromStdin.includes('\n'))
            dataFromStdin = dataFromStdin.split('\n').map(v => v.trim());
        else dataFromStdin = [dataFromStdin].filter(Boolean);
    }

    const context = {
        args: args,
        url: args[0],
        next: [],
        nextSeparator: '\n',
        trace: false,
        download: false,
        downloadfname: '',
        printRedirection: false,
        message: {
            data: null,
            size: null,
        },
        http: {
            method: 'GET',
            useragent:
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            nofollow: false,
            headers: [],
        },
    };

    if (dataFromStdin.length > 0) {
        context.url = dataFromStdin[0];
        if (dataFromStdin.length > 1)
            context.next = [...dataFromStdin.slice(1)];
    }

    let temp;
    for (let i = 0; i < args.length; i++) {
        let arg = args[i];
        switch (arg) {
            case '-t':
            case '--text': // --text somecontent
                context.message.data = args.slice(++i, i + 1).join(' ');
                context.message.size = Buffer.byteLength(context.message.data);
                break;

            case '-b':
            case '--bytes': // --bytes "73 6f 6d 65 63 6f 6e 74 65 6e 74"
                context.message.data = args
                    .slice(++i, i + 1)
                    .map(x => parseInt(x, 16))
                    .join(' ');
                context.message.size = Buffer.byteLength(context.message.data);
                break;

            case '-d':
            case '--download': // --download filename OR --download
                context.download = true;
                temp = args.slice(i + 1, i + 2).join(' ');
                if (!temp.startsWith('-'))
                    context.downloadfname = args.slice(++i, i + 1).join(' ');
                break;

            case '-n':
            case '--next':
                context.next.push(args.slice(++i, i + 1).join(' '));
                break;

            case '-N':
            case '--next-separator':
                context.nextSeparator = args.slice(++i, i + 1).join(' ');
                context.nextSeparator = context.nextSeparator
                    .replaceAll('\\n', '\n')
                    .replaceAll('\\t', '\t');
                break;

            case '-f':
            case '--file': // --file ./example/file.bin
                context.message.data = fs.readFileSync(
                    args.slice(++i, i + 1).join(' ')
                );
                context.message.size = Buffer.byteLength(context.message.data);
                break;

            case '-s':
            case '--trace':
                context.trace = true;
                break;

            case '-x':
            case '--method':
                context.http.method = args.slice(++i, i + 1).join('');
                break;

            case '-p':
            case '--print-redirection':
                context.printRedirection = true;
                break;

            case '-U':
            case '--http-useragent':
                context.http.useragent = args.slice(++i, i + 1).join('');
                break;

            case '-F':
            case '--http-nofollow':
                context.http.nofollow = true;
                break;

            case '-H':
            case '--http-header':
                context.http.headers.push(args.slice(++i, i + 1).join(''));
                break;
        }
    }
    sendPacket(context);
})();
