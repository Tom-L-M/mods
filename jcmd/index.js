const fs = require('fs');
// const util = require('node:util');

function safeParseJSON(string) {
    try {
        return JSON.parse(string);
    } catch (e) {
        return undefined;
    }
}

function safeStringifyJSON(string) {
    try {
        return JSON.stringify(string, null, '\t');
    } catch (e) {
        return undefined;
    }
}

function unsafeEditObject(string, value, context) {
    return eval(
        `(() => { let _ = (${JSON.stringify(
            context
        )}); _.${string} = ${value}; return _; })()`
    );
}

const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

function printVersion() {
    try {
        console.log(require(exeresolve('jcmd/package.json')).version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

(function main() {
    const help = `
        [jsoncmd-js]
            A tool for editing json fields in files from command line.

        Usage:
            jcmd <file> <-k key> <-v value>
            
        Options:
            -h | --help         Prints the help message and quits.
            -v | --version      Prints the version info and quits.
            -k | --key X
            -n | --value X

        Info:
            > 'value' field must be any valid JSON-decodable value.
              Ex: numbers, arrays, literal objects, strings.
            > 'key' must be a valid field name, concatenated by dot notation.
              A field 'target' in the JSON object '{ a: { b: target: 1, c:[] } }' can be
              changed to 2 by 'jcmd -k a.b.target -v 2';
              Arrays are accessible with bracket notation: 'jcmd -k a.b.c[1] -v 2';

            > To remove a key from the object, simply set it to undefined.`;

    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('-h') || args.includes('--help'))
        return console.log(help);

    if (args.includes('-v') || args.includes('--version'))
        return printVersion();

    let file = args[0];
    if (!file || !fs.existsSync(file))
        return console.log('Error: invalid file path provided [' + file + '].');

    let keyindex = args.includes('--key')
        ? args.indexOf('--key')
        : args.includes('-k');
    if (keyindex < 0)
        return console.log(
            'Error: invalid key [undefined] provided. Use --help to see the help menu.'
        );
    let key = args[keyindex + 1];

    let valindex = args.includes('--value')
        ? args.indexOf('--value')
        : args.indexOf('-n');
    if (valindex < 0)
        return console.log(
            'Error: invalid value [undefined] provided. Use --help to see the help menu.'
        );
    let val = args[valindex + 1];

    let context = fs.readFileSync(file, 'utf-8');
    context = safeParseJSON(context);
    if (!context)
        return console.log(
            'Error: invalid JSON data found in file [' + file + '].'
        );

    context = unsafeEditObject(key, val, context);
    if (!context)
        return console.log(
            'Error: invalid JSON data attribution with { key:' +
                key +
                ', value:' +
                value +
                ' }.'
        );

    context = safeStringifyJSON(context);
    fs.writeFileSync(file, context);

    console.log(`Changed: \t${key} = ${val}`);
})();
