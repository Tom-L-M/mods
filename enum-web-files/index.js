const https = require('https');

(async function main() {
    const help = `
    [enum-web-files-js]
        Find public files of specified extension in a domain over the internet

    Usage:
        enum-web-files <domain> [options]
    
    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -V | --verbose      Default: false.
        -m | --max-search   Default: 100 - First 100 results.
        -t | --timeout      Default: 10 seconds.
        -f | --filetype     Default: txt - Files to search for.`;
    const args = process.argv.slice(2);

    if (args.includes('--version') || args.includes('-v'))
        return console.log(require('./package.json')?.version);
    if (args.includes('--help') || args.includes('-h') || !args[0])
        return console.log(help);

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
    if (filetypes.length < 1) filetypes.push('txt');

    const buildURI = () =>
        `https://www.google.com/search?num=${maxsearch}&q=site:${domain}+filetype:${filetypes.join(
            '+OR+filetype:'
        )}`;

    function request(url) {
        return new Promise((resolve, reject) => {
            let data = [];
            https
                .get(url, res => {
                    res.on('data', chunk => data.push(chunk));
                    res.on('end', () => {
                        data = Buffer.concat(data);
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

        let sub = rawdata;
        let acc = [];
        let point = 0;
        let tmp;

        while (sub.includes(searchstring)) {
            const cchars = (c, s) =>
                s.split('').reduce((a, h) => (h === c ? a + 1 : a), 0);

            point = sub.indexOf(searchstring);
            sub = sub.slice(point + searchstring.length);
            tmp = sub.slice(0, sub.indexOf('&amp;'));
            tmp = tmp.replace('http://', '').replace('https://', '');
            if (!tmp.includes(domain)) continue;
            if (verbose) {
                acc.push(
                    [
                        tmp.slice(tmp.indexOf('/'), tmp.lastIndexOf('/')) +
                            '/' +
                            tmp.slice(tmp.lastIndexOf('/') + 1),
                    ].join('')
                );
            } else {
                if (cchars('/', tmp) > 1) {
                    acc.push(
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

        return acc.slice(2, -1).map(x => x.replaceAll(domain, ''));
    }

    try {
        const uri = buildURI();
        const response = await request(uri);
        const results = parseResponse(response);
        console.log(results.join('\n').trim());
    } catch (err) {
        console.log('<> Error: ' + err.message);
    }
})();
