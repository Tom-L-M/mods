const fs = require('fs');
const { parseArgv } = require('../shared');

function readStdinAsync() {
    return new Promise((resolve, reject) => {
        const stream = process.stdin;
        const chunks = [];

        const onData = chunk => chunks.push(chunk);
        const onEnd = () => quit() && resolve(Buffer.concat(chunks));
        const onError = err => quit() && reject(err);

        const quit = () => {
            stream.removeListener('data', onData);
            stream.removeListener('end', onEnd);
            stream.removeListener('error', onError);
            return true;
        };

        stream.on('data', onData);
        stream.on('end', onEnd);
        stream.on('error', onError);
    });
}

const isSTDINActive = () => !process.stdin.isTTY;

function safeParseJSON(string) {
    try {
        return JSON.parse(string);
    } catch (err) {
        console.log('Error: Invalid JSON data found - ' + err.message);
        return null;
    }
}

function safeStringifyJSON(string) {
    try {
        return JSON.stringify(string, null, '    ');
    } catch {
        return undefined;
    }
}

function unsafeEditObject(string, value, context) {
    return eval(
        `(() => { let _ = (${JSON.stringify(
            context
        )}); _.${string} = ${JSON.stringify(value)}; return _; })()`
    );
}

function unsafeReachObject(string, context) {
    if (!string) return JSON.stringify(context, null, '\t');
    return eval(
        `(() => { let _ = (${JSON.stringify(
            context
        )}); return _.${string}; })()`
    );
}

(async function main() {
    const help = `
        [json]
            A tool for editing json fields in files from command line.

        Usage:
            json <file> <-k key> [-n value]
           OR
            <stdin> | json [-] <-k key> [-n value]
            
        Options:
            -h | --help         Prints the help message and quits.
            -v | --version      Prints the version info and quits.
            -k | --key X
            -n | --value X

        Info:
            > Passing a JSON object without selecting a key '-k' will result in it being formatted.
            > 'key' must be a valid field name, concatenated by dot notation.
              A field 'target' in the JSON object '{ a: { b: target: 1, c:[] } }' can be
              changed to 2 by 'json -k a.b.target -n 2';
              Arrays are accessible with bracket notation: 'json -k a.b.c[1]';
            > 'value' field must be any valid JSON-decodable value.
            > If value is not provided, the current key value is printed.
            > To remove a key from the object, set it to undefined.`;

    const opts = { h: 'help', v: 'version', k: 'key', n: 'value' };
    const args = parseArgv(opts);
    const argv = process.argv.slice(2);

    if ((argv.length === 0 && !isSTDINActive()) || args.help)
        return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    let file = argv[0];
    let val = args.value;
    let key = args.key;
    let context;

    if (isSTDINActive() || file === '-') {
        context = (await readStdinAsync()).toString('utf-8');
    } else {
        if (!fs.existsSync(file))
            return console.log(
                'Error: invalid file path provided [' + file + '].'
            );
        context = fs.readFileSync(file, 'utf-8');
    }

    context = safeParseJSON(context);
    if (!context) return;

    if (key && val) {
        context = unsafeEditObject(key, val, context);
        if (!context)
            return console.log(
                'Error: invalid JSON data attribution with { key:' +
                    key +
                    ', value:' +
                    val +
                    ' }.'
            );

        console.log(safeStringifyJSON(context));
    } else {
        console.log(unsafeReachObject(key, context));
    }
})();
