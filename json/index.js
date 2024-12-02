const fs = require('fs');
const { isSTDINActive, readStdinAsync, ArgvParser } = require('../shared');

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
            json <file> [-k KEY] [-n VALUE]
           OR
            <stdin> | json [-] [-k KEY] [-n VALUE]
            
        Options:
            -h | --help         Prints the help message and quits.
            -v | --version      Prints the version info and quits.
            -k | --key KEY        
            -n | --value VALUE

        Info:
            > Passing a JSON object without selecting a key '-k' will result in it being formatted.
            > 'key' must be a valid field name, concatenated by dot notation.
              A field 'target' in the JSON object '{ a: { b: target: 1, c:[] } }' can be
              changed to 2 by 'json -k a.b.target -n 2';
              Arrays are accessible with bracket notation: 'json -k a.b.c[1]';
            > 'value' field must be any valid JSON-decodable value.
            > If value is not provided, the current key value is printed.
            > To remove a key from the object, set it to undefined.`;

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('value', { alias: 'v', allowValue: false });
    parser.option('key', { alias: 'k' });
    parser.option('value', { alias: 'n' });
    parser.argument('file');
    const args = parser.parseArgv();

    if ((!args.file && !isSTDINActive()) || args.help) return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    let file = args.file;
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
