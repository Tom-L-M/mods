/**
 * Parses the CLI arguments (process.argv), dividing the flags into properties of an object.
 * Multi-word params are divided as "param":"value", while sinle-word params becomes: "param":true.
 * Lost values will be ignored*. So 'node example.js 000 --param1' will turn into: { param1:true } and '000' will be ignored.
 *   * Unless they are defined as aliases for other parameters. So, if mapping is defined as { '000':'param0' },
 *     the result will be { param1:true, param0: true } instead of { param1:true }
 * Aliases in 'mapping' do not take priority over regular double-word parameters
 *
 * @since 1.2.14
 *
 * @param {Object} mapping An object mapping the arguments alias. Always take the form of "alias":"originalProperty"
 * @return {Object} An object containing the arguments parsed, and their values
 *
 * @example <caption>  </caption>
 * // called the script with:
 * // node example.js build --param1 --param2 pvalue -p 0000
 * parseArgv({ "p": "param3" })
 * // creates:
 * {
 *   build: true
 *   param1: true
 *   param2: p2value
 *   param3: 0000
 * }
 */
const parseArgv = (mapping = {}, argv = process.argv.slice(2)) => {
    let params = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--'))
            params[argv[i].slice(2)] =
                argv[i + 1]?.startsWith('-') || !argv[i + 1] ? true : argv[++i];
        else if (argv[i].startsWith('-'))
            params[argv[i].slice(1)] =
                argv[i + 1]?.startsWith('-') || !argv[i + 1] ? true : argv[++i];
        else params[argv[i]] = true;
    }
    for (let key in mapping) {
        if (params[key]) {
            params[mapping[key]] = params[key];
            delete params[key];
        }
    }
    return params;
};

const help = `
    [uuid-js]
        A tool for generating virtual UUIDs (Version 4 - Random)

    Usage:
        uuid [-v|--version] [-h|--help] <-c|--count AMOUNT> [-t|--type 4|7] [-u|--upper] 
        
    Info:
        - Default for "--count" is 1
        - Default for "--type" is 4
        - Default for "--upper" is false
        - "amount" is used for bulk generation and must be an integer between 1 and 99
        - "type" is the UUID version. Supported versions are: 4 and 7
        - "upper" defines if UUIDs will be generated in upper-case or not`;
const randomItem = array => array[Math.floor(Math.random() * array.length)];
const addVariantBit = uuidString =>
    uuidString.replace('X', randomItem(['8', '9', 'a', 'b']));
const randomDigit = () => Math.random().toString(16)[6];
const isValidInt = int =>
    !(int === true || int === false || isNaN(Number(int)));

const unixTime = {};
unixTime.raw = () => Math.floor(Date.now() / 1000).toString();
unixTime.low = () => unixTime.raw().slice(8);
unixTime.high = () => unixTime.raw().slice(0, 8);

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

function printVersion() {
    try {
        console.log(require('./package.json').version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

(function () {
    // uuid -h/--help
    // uuid -c/--count <INT> -u/--uuidv <4|7|nil|max>
    const argv = parseArgv({
        h: 'help',
        v: 'version',
        c: 'count',
        t: 'type',
        u: 'upper',
    });

    if (argv.version) return printVersion();
    if (argv.help || !isValidInt(argv.count)) return console.log(help);

    const options = {
        uuid_version: argv.type || '4',
        count: parseInt(argv.count || 1),
        upperCase: !!argv.upper,
    };

    if (options.count > 99 || options.count < 1)
        return console.log(
            `\n Error: Invalid UUID bulk count provided [${options.count}] - Expected between 1 and 99`
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
                `\n Error: Invalid UUID version provided [${options.uuid_version}] - Expected one of: [4|7|NIL|MAX]`
            );
    }

    let out = [];
    for (let i = 0; i < options.count; i++) out.push(generate());

    if (options.upperCase) out = out.map(v => v.toUpperCase());
    out = out.join('\n');
    console.log(out);
})();
