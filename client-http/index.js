const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const fs = require('node:fs');
const {
    isStdinActive,
    readStdin,
    ArgvParser,
    parseControlChars,
} = require('../shared');

const MAX_TIMEOUT_RETRIES = 5;
const TIMEOUT_INTERVAL = 5000;

const isDirectory = file =>
    fs.existsSync(file) && fs.statSync(file).isDirectory();
const is200Code = res => res.statusCode.toString().startsWith('2');
const is300Code = res => res.statusCode.toString().startsWith('3');
const vID = () =>
    '################'.replace(/[#]/gm, () => Math.random().toString(16)[6]);
const cloneObject = obj => JSON.parse(JSON.stringify(obj));

const sleep = timeMs => new Promise(resolve => setTimeout(resolve, timeMs));

const formatAsUpperKebabCase = string => {
    return string
        .split(' ')
        .join('-')
        .split('-')
        .map(v => v[0].toUpperCase() + v.slice(1))
        .join('-');
};

const secureFileName = str => {
    let uri;
    try {
        uri = decodeURIComponent(str);
    } catch {
        // catch any error raised by a malformed URI, and instead of parsing the HTTP tokens, strip them
        uri = str;
    }
    return uri
        .replaceAll('?', '_')
        .replaceAll(
            /[^a-z0-9 '!@#$%¨`´~^& \,\.\-_=\[\]\(\)çáàâäãéèêëíìîïóòôöõúùûüñýÿÇÁÀÂÄÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÝ]/gi,
            ''
        );
};

const readLinksFromSTDIN = stdindata => {
    return stdindata
        .split('\n')
        .map(v => v.trim())
        .filter(Boolean);
};

const fileNameFromURI = IURL => {
    if (IURL.pathname === '/') return vID();
    let lastpart = IURL.pathname.split('/').pop();
    if (IURL.search) lastpart += IURL.search;
    return secureFileName(lastpart);
};

const formatResponseHeaders = (responseHeaders, prefix = '') => {
    let acc = '';
    for (let prop in responseHeaders) {
        acc +=
            prefix +
            formatAsUpperKebabCase(prop) +
            ': ' +
            responseHeaders[prop] +
            '\n';
    }
    return acc.trimEnd();
};

// Converts MS to time units:
// 3500 becomes "3.30 seconds"...
const milissecondsAsTimeUnits = float => {
    float = float / 60000; // => From MS to
    const hours = Math.floor(float / 60); // Extract hours from total minutes
    const totalMinutes = Math.floor(float); // Total minutes
    const minutes = totalMinutes % 60; // Remaining minutes after hours
    const totalSeconds = (float - totalMinutes) * 60; // Fractional part converted to total seconds
    const seconds = Math.floor(totalSeconds); // Extract whole seconds
    const milliseconds = Math.round((totalSeconds - seconds) * 1000); // Remaining fractional part converted to ms

    // Handle cascading overflow
    let finalMinutes = minutes;
    let finalHours = hours;
    let finalSeconds = seconds;
    // let finalMilliseconds = milliseconds;

    if (milliseconds === 1000) {
        // finalMilliseconds = 0;
        finalSeconds += 1; // Increment seconds
    }
    if (finalSeconds === 60) {
        finalSeconds = 0;
        finalMinutes += 1; // Increment minutes
    }
    if (finalMinutes === 60) {
        finalMinutes = 0;
        finalHours += 1; // Increment hours
    }

    // Construct the time string
    let timeString =
        `${finalHours.toString().padStart(2, '0')}:` +
        `${finalMinutes.toString().padStart(2, '0')}:` +
        `${finalSeconds.toString().padStart(2, '0')}`;
    // If you want to add the milisseconds to the counter, just uncomment here and up some lines
    // `${finalMilliseconds.toString().padStart(3, '0')}`;
    return timeString.trim();
};

const printDownloadHeader = fname => {
    console.log(`+ Downloading as [${fname}]`);
    console.log(
        `    %    Total           Received        Elapsed         Speed`
    );
    return;
};

const printDownloadInfo = (total, recv, startingTimeMS, lastChunkSize) => {
    // Sometimes, the server sends back the "['content-size']" header as a string
    // So, o convert it to a number, to prevent problems later
    if (typeof total === 'string') total = parseInt(total, 10);
    if (typeof recv === 'string') recv = parseInt(recv, 10);

    const elapsed = Date.now() - startingTimeMS;

    process.stdout.write('\r');
    process.stdout.write(' '.repeat(process.stdout.columns - 1));
    process.stdout.write('\r');

    let unit_total = total > 1000000 ? 'mb' : total > 1000 ? 'kb' : 'b';
    let unit_recv = recv > 1000000 ? 'mb' : recv > 1000 ? 'kb' : 'b';

    let value_tot =
        total > 1000000 ? total / 1000000 : total > 1000 ? total / 1000 : total;
    if (value_tot)
        value_tot = (value_tot.toFixed(2) + ' ' + unit_total).padEnd(16, ' ');

    let value_recv =
        recv > 1000000 ? recv / 1000000 : recv > 1000 ? recv / 1000 : recv;
    if (value_recv)
        value_recv = (value_recv.toFixed(2) + ' ' + unit_recv).padEnd(16, ' ');

    let value_elapsed = elapsed;
    if (value_elapsed)
        value_elapsed = milissecondsAsTimeUnits(value_elapsed).padEnd(16, ' ');

    let speed = lastChunkSize;
    if (lastChunkSize > 1000000) {
        speed = (Math.abs(lastChunkSize) / 1000000).toFixed(2) + ' Mb/s';
    } else if (lastChunkSize > 1000) {
        speed = (Math.abs(lastChunkSize) / 1000).toFixed(2) + ' Kb/s';
    } else {
        speed = Math.abs(lastChunkSize).toFixed(2) + ' bytes/s';
    }
    speed = speed.padEnd(16, ' ');

    if (!total) {
        process.stdout.write(
            `    -    ---             ${value_recv}${value_elapsed}${speed}`.trimEnd()
        );
    } else {
        let stats = Math.ceil((recv / total) * 100)
            .toString()
            .padStart(3, ' ');
        process.stdout.write(
            `  ${stats}    ${value_tot}${value_recv}${value_elapsed}${speed}`.trimEnd()
        );
    }

    return;
};

async function sendPacket(context, { firstRun = false } = {}) {
    let {
        url,
        next,
        download,
        timeout,
        retryOnTimeout,
        timeoutRetries,
        noOutput,
        dump,
        trace,
        method,
        httpHeaders,
        httpNofollow,
        nextSeparator,
        httpUseragent,
        message,
    } = context;

    // Prints an empty line for formatting
    // But skips if it is the first run (nothing before to separe)
    // or if there is a proper output separator selected
    if (!firstRun) console.log();

    const protocol = url.protocol === 'http:' ? http : https;
    const options = {
        method: method,
        hostname: url.hostname,
        port: url.port,
        path: url.href.replace(url.origin, ''),
        headers: { 'User-Agent': httpUseragent },
        timeout,
        agent: firstRun ? false : undefined,
    };

    return new Promise(resolve => {
        for (let header of httpHeaders) {
            let [name, ...body] = header.split(':');
            options.headers['' + name] = body[0].trim();
        }

        if (message) {
            options.headers['Content-Length'] = message.length;
            options.headers['Content-Type'] =
                'application/x-www-form-urlencoded';
        }

        const request = protocol.request(options, async res => {
            const startMS = Date.now();

            let outputsize = 0;
            let printedData = false;
            // Tracks printing intervals, to avoid printing the same info repeatedly on stale connections
            let lastInfoPrint = 0;
            // Tracks download speed with metered chunks per second
            let lastChunkSize = 0;

            if (dump) {
                console.log(
                    'HTTP/' + res.httpVersion,
                    res.statusCode.toString(),
                    res.statusMessage
                );
                console.log(formatResponseHeaders(res.headers), '\n');
            }

            console.log(
                `+ ${options.method} (${res.statusCode} ${res.statusMessage}) - ${url}`
            );

            if (trace) {
                if (message) {
                    console.log(
                        `+ Sent data: ${message.length || message.size} bytes`
                    );
                }
                console.log(
                    `+ Response headers: \n` +
                        `${formatResponseHeaders(res.headers, ' -  ')}\n`
                );
            }

            let fname,
                safeToPrintOnSTDOUT = true;

            // If the user opted for no output, block console printing
            // and block download feature (even if --output is also selected).
            if (noOutput) {
                safeToPrintOnSTDOUT = false;
                download = false;
            }

            // If a dot is provided, ignore and treat as empty (auto-name download)
            if (download === '.') download = '';

            if (download === '') download = fileNameFromURI(url);
            if (download && download !== '-') {
                fname = path.resolve(download);

                // If the provided download path is a directory, append a filename to it
                if (isDirectory(fname)) {
                    fname = path.join(fname, fileNameFromURI(url));
                }

                try {
                    if (firstRun) fs.writeFileSync(fname, Buffer.alloc(0));
                } catch {
                    console.log(
                        `x Error: Cannot write to download destination [${fname}]. Aborting.`
                    );
                    return resolve();
                }

                if (is200Code(res)) {
                    printDownloadHeader(fname);
                }
            }

            // If the user accepts the risk of printing to STDOUT:
            else if (download === '-') {
                safeToPrintOnSTDOUT = true;
            }

            // If there is no download selected, and the data is non-textual (binary)
            // skips printing and warn the client
            else {
                let mime = res.headers['content-type'];
                if (!mime.includes('text') && !mime.includes('json')) {
                    safeToPrintOnSTDOUT = false;
                    console.log(
                        'Warning: There may be binary data on the output. Printing to STDOUT could be dangerous. \nUse "--output [FILE]" to safely output the data to a file, or "--output -" if you want to output it to terminal anyway.'
                    );
                    console.log(mime);
                }
            }

            res.on('data', chunk => {
                outputsize += chunk.length;
                lastChunkSize += chunk.length;
                if (download && is200Code(res) && download !== '-') {
                    fs.appendFileSync(fname, chunk);

                    // Let the download status update very 1 second (1000ms)
                    if (lastInfoPrint + 1000 < Date.now()) {
                        printDownloadInfo(
                            res.headers['content-length'] || chunk.length,
                            outputsize,
                            startMS,
                            lastChunkSize
                        );
                        lastInfoPrint = Date.now();
                        lastChunkSize = 0;
                    }
                } else if (!trace && is300Code(res)) {
                    // placeholder
                } else {
                    if (safeToPrintOnSTDOUT) {
                        printedData = true;
                        process.stdout.write(chunk.toString('utf-8'));
                    }
                }
            });

            res.on('end', async () => {
                if (printedData && !nextSeparator) console.log(); // Empty line for styling if something was already printed

                // If there is no following to do, print result of current download
                if (is200Code(res)) {
                    if (download && download !== '-') {
                        printDownloadInfo(
                            res.headers['content-length'] || outputsize,
                            outputsize,
                            // res.headers['content-length'] || outputsize,
                            startMS,
                            lastChunkSize
                        );
                        if (trace)
                            console.log(
                                `+ Total data received (${outputsize} bytes) ` +
                                    `- Saved in [${fname}]`
                            );
                        console.log();
                    }
                }

                // If redirection following is requested, and there is a redirection destination
                if (is300Code(res) && res.headers.location && !httpNofollow) {
                    if (trace)
                        console.log(
                            `+ Client informed redirection - Redirecting to [${res.headers.location}]`
                        );

                    const redirectionContext = cloneObject(context);

                    // Prevent recursive calls of going to next URLs
                    redirectionContext.next = [];

                    // Provided an absolute url for redirection: e.g. https://newplace.com/something
                    if (res.headers.location.startsWith('http')) {
                        redirectionContext.url = new URL(res.headers.location);
                    }
                    // Provided a relative url for redirection: e.g. /something
                    else {
                        redirectionContext.url = new URL(
                            url.origin + res.headers.location
                        );
                    }

                    await sendPacket(redirectionContext); // Send a new request to the proper place now
                }

                // Start fetching the next URLs
                if (next.length > 0) {
                    const nextURL = next[0];
                    const nextContext = cloneObject(context);
                    if (nextURL) {
                        nextContext.url = new URL(nextURL);
                        nextContext.next = next.slice(1) || [];
                        nextContext.append = true;

                        // If download is requested, and there is a separator then keep downloading in the same file
                        if (download && nextSeparator) {
                            nextContext.download = download;
                        }
                        // If download is requested, but there is no separator
                        // download in a different file
                        else if (download) {
                            // If download is requested, and the download path is a directory name,
                            //   keep using it (the filename after the dir will be automatically changed)
                            if (isDirectory(download))
                                nextContext.download = download;
                            // Else, if download is requested, but the path is a file name, refresh it
                            else nextContext.download = '';
                        }
                        // If no download is requested, skip it
                        else {
                            nextContext.download = false;
                        }

                        if (!download || download === '-')
                            process.stdout.write(nextSeparator || '\n\n');
                        else fs.appendFileSync(fname, nextSeparator);

                        await sendPacket(nextContext);
                        resolve();
                    }
                }

                // If there is nothing more to do, quit
                resolve();
            });
        });

        request.on('socket', () => {
            if (trace) console.log(`+ Trying ${context.url}...`);
        });

        request.on('error', err => {
            // If the request was already destroyed, it means the 'timeout' was triggered first
            // so we only print the error message if there was no other destructible event before
            if (!request.destroyed) {
                request.destroy();
            }
            if (trace && err.code !== 'ETIMEDOUT')
                console.log(
                    `- Error: Could not connect to "[${options.method}] ${url}" - ${err.code} - ${err.message}`
                );
            // Exit with an error level greater than 0, to inform that the request failed
            process.exitCode = 1;
            resolve();
        });

        request.on('timeout', async () => {
            if (trace)
                console.log(
                    `- Timeout: Could not connect to "[${options.method}] ${url}" (${timeout} ms)`
                );

            // Try again if informed
            if (retryOnTimeout && timeoutRetries < MAX_TIMEOUT_RETRIES) {
                timeoutRetries = context.timeoutRetries += 1;

                if (trace)
                    console.log(
                        `+ Trying again "[${options.method}] ${url}" - Attempt: ${timeoutRetries}/${MAX_TIMEOUT_RETRIES} - Interval: ${TIMEOUT_INTERVAL} ms`
                    );

                await sleep(TIMEOUT_INTERVAL);
                await sendPacket(context);
                return resolve();
            }

            // To prevent the redundant 'socket hang up' error from appearing, we destroy the request
            // in order to inform the callback for the error event, that it shouldn't log anything
            request.destroy();
            // Exit with an error level greater than 0, to inform that the request failed
            process.exitCode = 1;
            resolve();
        });

        if (message) {
            request.write(message, () => request.end());
        } else {
            request.end();
        }
    });
}

(async () => {
    const help = `
    [client-http-js]
        A tool for sending HTTP requests for servers and services

    Usage:
        client-http <URL> [options]
       OR
        <stdin> | client-http [options]

    Options:
        -h | --help                     Prints the help message and quits.
        -v | --version                  Prints the version info and quits.
        -t | --trace                    Prints information about connections, data, and redirections.
        -i | --include-headers          Includes the response headers, dumping the HTTP response as-is.
        -x | --method <METHOD>          Sets a request method (defaults to 'GET'). Both "x" and "X" are valid.
        -o | --output [FILE | - | .]    Downloads the response content instead of displaying it.
                                        Set to '-' to output to STDOUT, or to '.' to download with an automatic file name.
        -O | --no-output                Ignores the response content. Behaves like a HEAD request (prints only status).
        -T | --timeout <MS>             Number of milisseconds to wait before triggering a timeout. Defaults to 3000ms.
        -R | --no-retry                 Do not retry on timeout.
        -D   --data-ascii <TEXT>        Sends a specific text as data in packet.
             --data-bytes <BYTES>       Sends a specific series of hex bytes as data in packet.
             --data-file <FILENAME>     Reads a file and sends its contents as data.
        -U | --http-useragent <AGENT>   Sets the user_agent header (defaults to Chrome standart).
        -F | --http-nofollow            Ignores 3XX-Redirection response codes.
        -H | --http-header <HEADER>     Sets a new HTTP header, inthe format of:    "Header: Content".
        -n | --next <URL>               Executes another request to URL, and concats the result after the first.
                                        Multiple --next flags may be used, and they will be requested in sequence.
        -c | --concat <STRING>          Concatenates the data from queries, with <STRING> as separator.
                                        (This affects downloads too: all data will be written to a single download file).

    Info:
        + It is possible to pass-in multiple URLs from STDIN, by dividing them with newlines ('\\n');
          This will cause the first URL to be the main one, and the rest to be passed as "--next" arguments.
            E.g. The call:      echo "link1 \\n link2" | client-http
            is the same as:     client-http link1 -n link2`;

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('trace', { alias: 't', allowValue: false });
    parser.option('include-headers', { alias: 'i', allowValue: false });
    parser.option('method', { alias: ['x', 'X'] });
    parser.option('output', { alias: 'o', allowDash: true });
    parser.option('no-output', { alias: 'O', allowValue: false });
    parser.option('timeout', { alias: 'T', allowCasting: true });
    parser.option('no-retry', { alias: 'R', allowValue: false });
    parser.option('data-ascii', { alias: 'D' });
    parser.option('data-bytes');
    parser.option('data-file');
    parser.option('http-useragent', { alias: 'U' });
    parser.option('http-nofollow', { alias: 'F', allowValue: false });
    parser.option('http-header', { alias: 'H', allowMultiple: true });
    parser.option('next', { alias: 'n', allowMultiple: true });
    parser.option('concat', { alias: 'c' });
    parser.argument('url');
    const args = parser.parseArgv();

    const stdinActive = isStdinActive();
    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!args.url && !stdinActive)) return console.log(help);

    const context = {
        url: args.url,
        next: args.next || [],
        download: args.output,
        dump: Boolean(args['include-headers']),
        noOutput: Boolean(args['no-output']),
        retryOnTimeout: !args['no-retry'],
        timeoutRetries: 0,
        trace: Boolean(args.trace),
        method: args.method || 'GET',
        httpHeaders: args['http-header'] || [],
        httpNofollow: Boolean(args['http-nofollow']),
        nextSeparator: parseControlChars(args.concat || '') || '',
        timeout: !isNaN(parseInt(args.timeout, 10)) ? args.timeout : 3000,
        httpUseragent:
            args['http-useragent'] ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        text: null,
        bytes: null,
        file: null,
        message: null,
    };

    // If multiple URLs are passed in a file, split them on '\n' and use the first as default url,
    // and the rest as '--next' parameters
    if (isStdinActive()) {
        let stdindata = (await readStdin()).toString('utf-8');
        let stdinlinks = await readLinksFromSTDIN(stdindata);

        if (stdinlinks.length) {
            if (!context.url) {
                context.url = stdinlinks[0];
                stdinlinks = stdinlinks.slice(1);
            }
            if (stdinlinks.length) {
                context.next.push(...stdinlinks);
            }
        }
    }

    // If both 'trace' and 'dump' are active, disable 'dump', as 'trace' already includes all the info
    if (context.trace && context.dump) context.dump = false;

    if (args['data-ascii']) {
        // --text somecontent
        context.message = Buffer.from(args['data-ascii']);
    }

    if (args['data-bytes']) {
        // --bytes "73 6f 6d 65 63 6f 6e 74 65 6e 74"
        context.message = Buffer.from(
            args['data-bytes'].split(' ').map(v => parseInt(v, 16))
        );
    }

    if (args['data-file']) {
        // --file ./example/file.bin
        if (!fs.existsSync(args['data-file']))
            return console.log(
                `Error: Invalid file path provided "${args['data-file']}"`
            );
        context.message = fs.readFileSync(args['data-file']);
    }

    try {
        context.url = new URL(context.url);
    } catch {
        return console.log(`Error: Invalid URL provided "${context.url}"`);
    }

    await sendPacket(context, { firstRun: true });
})();
