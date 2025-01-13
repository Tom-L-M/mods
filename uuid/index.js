const { ArgvParser } = require('../shared');

const randomItem = array => array[Math.floor(Math.random() * array.length)];
const addVariantBit = uuidString =>
    uuidString.replace('X', randomItem(['8', '9', 'a', 'b']));
const randomDigit = () => Math.random().toString(16)[6];

const unixTS = () => Math.floor(new Date().getTime() / 1000).toString();

const unixTime = {};
unixTime.low = () => unixTS().slice(8).padStart(4, '0');
unixTime.high = () => unixTS().slice(0, 8).padStart(8, '0');

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
        A tool for generating UUIDs (v4)

    Usage:
        uuid [options]
        
    Options:
        -h | --help         Prints the help message.
        -v | --version      Prints the version info.
        -c | --count INT    Prints a batch of ids.
        -u | --upper        Prints the UUID in upper-case mode. Default: false.
        -d | --no-dash      Removes the dashes. Default: false.`;

(function () {
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('count', { alias: 'c', allowCasting: true });
    parser.option('upper', { alias: 'u', allowValue: false });
    parser.option('no-dash', { alias: 'd', allowValue: false });
    parser.argument('path');
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help) return console.log(help);

    const selectedOptions = {
        count: parseInt(args.count || 1),
        upperCase: args.upper,
        noDash: args['no-dash'],
    };

    if (selectedOptions.count < 1)
        return console.log(
            `\n Error: Invalid UUID bulk count provided [${selectedOptions.count}] - Expected a positive integer.`
        );

    let out = [];
    for (let i = 0; i < selectedOptions.count; i++) out.push(uuid.v4());

    if (selectedOptions.upperCase) out = out.map(v => v.toUpperCase());
    if (selectedOptions.noDash) out = out.map(v => v.replaceAll('-', ''));
    console.log(out.join('\n').trim());
})();
