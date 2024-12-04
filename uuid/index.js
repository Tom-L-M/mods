const { ArgvParser } = require('../shared');

const randomItem = array => array[Math.floor(Math.random() * array.length)];
const addVariantBit = uuidString =>
    uuidString.replace('X', randomItem(['8', '9', 'a', 'b']));
const randomDigit = () => Math.random().toString(16)[6];

const unixTime = {};
unixTime.raw = () => Math.floor(Date.now() / 1000).toString();
unixTime.low = () => unixTime.raw().slice(8).padStart(4, '0');
unixTime.high = () => unixTime.raw().slice(0, 8).padStart(8, '0');

const uuid = {
    // Random
    v4: () =>
        addVariantBit(
            '########-####-4###-X###-############'.replace(
                /[#]/gim,
                randomDigit
            )
        ),
    // Time-Based Random
    v7: () =>
        addVariantBit(
            `${unixTime.high()}-${unixTime.low()}-7###-X###-############`.replace(
                /[#]/gim,
                randomDigit
            )
        ),
};

const help = `
    [uuid-js]
        A tool for generating virtual UUIDs (Version 4 - Random)

    Usage:
        uuid [options]
        
    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -c | --count INT    Prints the complete help message and quits. Default: 1.
        -u | --upper        Prints the UUID in upper-case mode. Default: false.
        -t | --type TYPE    Selects the UUID type (4 or 7). Default: 4.`;

(function () {
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('count', { alias: 'c', allowCasting: true });
    parser.option('upper', { alias: 'u', allowValue: false });
    parser.option('type', { alias: 't' });
    parser.argument('path');
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help) return console.log(help);

    const options = {
        uuid_version: args.type || '4',
        count: parseInt(args.count || 1),
        upperCase: !!args.upper,
    };

    if (options.count < 1)
        return console.log(
            `\n Error: Invalid UUID bulk count provided [${options.count}] - Expected a positive integer.`
        );

    let generate = () => {};

    switch (options.uuid_version) {
        case '4':
            generate = uuid.v4;
            break;
        case '7':
            generate = uuid.v7;
            break;
        default:
            return console.log(
                `\n Error: Invalid UUID version provided [${options.uuid_version}] - Expected types 4 or 7`
            );
    }

    let out = [];
    for (let i = 0; i < options.count; i++) out.push(generate());

    if (options.upperCase) out = out.map(v => v.toUpperCase());
    out = out.join('\n');
    console.log(out);
})();
