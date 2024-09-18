const https = require('https');

const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

function printVersion() {
    try {
        console.log(require(exeresolve('enum-web-files/package.json')).version);
    } catch (err) {
        console.log('Error: could not read package descriptor.');
    }
}

(async function main() {
    const help = `
    [enum-web-files-js]
        Find public files of specified extension in a domain over the internet

    Usage:
        enum-web-files <domain> [options]
    
    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -V | --verbose      Default: false
        -m | --max-search   Default: 100 - First 100 results
        -t | --timeout      Default: 10 s
        -f | --filetype     Default: txt - Files to search for`;
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h') || !args[0])
        return console.log(help);
    if (args.includes('--version') || args.includes('-v'))
        return printVersion();

    const domain = args[0];
    let filetypes = [];
    let verbose = false;
    let maxsearch = 100;
    let timeout = 10000;

    for (let i = 1; i < args.length; i++) {
        let cur = args[i];
        let next = args[i + 1];
        if (cur == '-V' || cur == '--verbose') {
            verbose = true;
        } else if (cur == '-f' || cur == '--filetype') {
            filetypes.push(next);
        } else if (cur == '-m' || cur == '--max-search') {
            maxsearch = Number(next);
        } else if (cur == '-t' || cur == '--timeout') {
            timeout = Number(next);
        }
    }

    if (!domain) return console.log(help);
    if (filetypes.length < 1)
        return console.log('<> Error: File types not specified');

    const buildURI = () =>
        `https://www.google.com/search?num=${maxsearch}&q=site:${domain}+filetype:${filetypes.join(
            '+OR+filetype:'
        )}`;

    function request(url) {
        const init = Date.now();
        console.log('>> Started Query');
        return new Promise((resolve, reject) => {
            let data = [];
            https
                .get(url, res => {
                    console.log(' > Status Code:', res.statusCode);
                    res.on('data', chunk => data.push(chunk));
                    res.on('end', () => {
                        data = Buffer.concat(data);
                        console.log(' > Bytes: ' + data.length);
                        console.log(
                            '>> Ended Query - Elapsed: ' +
                                (Date.now() - init) +
                                ' ms\n'
                        );
                        resolve(data.toString('utf-8'));
                    });
                })
                .setTimeout(timeout)
                .on('error', e => reject(e))
                .on('timeout', () => reject(new Error('TIMEOUT')));
        });
    }

    function parseResponse(rawdata) {
        const searchstring = 'href="/url?q=';
        const init = Date.now();

        let sub = rawdata;
        let acc = [];
        let point = 0;
        let tmp;

        let counter = 0;

        while (sub.includes(searchstring)) {
            const cchars = (c, s) =>
                s.split('').reduce((a, h) => (h === c ? a + 1 : a), 0);

            counter++;
            point = sub.indexOf(searchstring);
            sub = sub.slice(point + searchstring.length);
            tmp = sub.slice(0, sub.indexOf('&amp;'));
            tmp = tmp.replace('http://', '').replace('https://', '');
            if (!tmp.includes(domain)) continue;
            if (verbose) {
                acc.push(
                    [
                        ' · ' +
                            tmp.slice(tmp.indexOf('/'), tmp.lastIndexOf('/')) +
                            '/' +
                            tmp.slice(tmp.lastIndexOf('/') + 1),
                    ].join('')
                );
            } else {
                if (cchars('/', tmp) > 1) {
                    acc.push(
                        ' · ' +
                            tmp.slice(0, tmp.indexOf('/') + 1) +
                            '.../' +
                            decodeURIComponent(
                                decodeURIComponent(
                                    tmp.slice(tmp.lastIndexOf('/') + 1)
                                )
                            )
                    );
                } else {
                    acc.push(
                        ' · ' +
                            tmp.slice(0, tmp.indexOf('/') + 1) +
                            decodeURIComponent(
                                decodeURIComponent(
                                    tmp.slice(tmp.lastIndexOf('/') + 1)
                                )
                            )
                    );
                }
            }
        }

        console.log(
            '>> Ended Parsing - ' +
                (Date.now() - init) +
                ' ms - ' +
                counter +
                ' cycles\n'
        );
        return acc.slice(0, -1).map(x => x.replaceAll(domain, ''));
    }

    try {
        const uri = buildURI();
        console.log('<> Looking for: ' + uri);
        const response = await request(uri);
        const results = parseResponse(response);
        console.log(results.join('\n'));
    } catch (err) {
        console.log('<> Error: ' + err.message);
    }
})();
