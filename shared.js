class Logger {
    constructor({ stdout, format, colors = true } = {}) {
        this.stdout = stdout || process.stdout;
        this.colors = colors;
        if (format && typeof format === 'function') {
            this.formatter = format;
        } else {
            this.formatter = param => {
                return JSON.stringify(param);
            };
        }
    }

    #timestampGenerator() {
        return new Date().toISOString();
    }

    #colorize(color = '', string) {
        if (!this.colors) return string;
        const colors = { red: 31, green: 32, blue: 34, yellow: 33 };
        return `\x1b[0m\x1b[${colors[color] || ''}m${string}\x1b[0m`;
    }

    #log(level, props, message) {
        let result = {
            timestamp: this.#timestampGenerator(),
            level,
        };

        if (typeof message !== 'string') {
            message = JSON.stringify(message);
        }

        if (typeof props !== 'object') {
            props = { info: props };
        }

        for (let prop in props) {
            result[prop] = props[prop];
        }

        result.message = message || result.message;
        result = this.formatter(result);
        if (this.colors) {
            result = this.#colorize(
                level === 'info'
                    ? 'blue'
                    : level === 'warn'
                    ? 'yellow'
                    : level === 'error'
                    ? 'red'
                    : level === 'debug'
                    ? 'green'
                    : null,
                result
            );
        }
        return this.stdout.write(result + '\n');
    }

    disableColors() {
        this.colors = false;
        return this;
    }

    enableColors() {
        this.colors = true;
        return this;
    }

    info(props, message) {
        return this.#log('info', props, message);
    }

    error(props, message) {
        return this.#log('error', props, message);
    }

    warn(props, message) {
        return this.#log('warn', props, message);
    }

    debug(props, message) {
        return this.#log('debug', props, message);
    }

    /**
     * Paints a text with specified foreground and background colors.
     *
     * Colors can be passed in either string mode, numerical mode, or hex mode.
     *
     * The colors available in string mode are the ones supported by 8/16 color terminals:
     * black, red, green, yellow, blue, magenta, cyan, white, default
     *
     * The colors available in numerical mode are the supported by 8-bit color terminals:
     * https://user-images.githubusercontent.com/995050/47952855-ecb12480-df75-11e8-89d4-ac26c50e80b9.png
     *
     * Hex mode can be the short (#RGB) or long (#RRGGBB) ones.
     * The terminal must support TrueColor.
     *
     * @param {string|number} foreground
     * @param {string|number} background
     * @returns {string}
     */
    print(text, foreground = '', background = '') {
        if (!this.colors) return console.log(text);
        const CSI = '\x1b[';
        const RESET = CSI + '0m';
        const COLOR_TABLE_8BIT = {
            black: 0,
            red: 1,
            green: 2,
            yellow: 3,
            blue: 4,
            magenta: 5,
            cyan: 6,
            white: 7,
            default: 9,
        };
        const fromColorCode = (color, type) => {
            // For 8-bit colors
            if (COLOR_TABLE_8BIT[color] !== undefined)
                return `${CSI}${type === 'fg' ? '3' : '4'}${
                    COLOR_TABLE_8BIT[color]
                }m`;
            // For complete colors
            else if (typeof color === 'number')
                return `${CSI}${type === 'fg' ? '3' : '4'}8;5;${color}m`;
            // For TrueColor mode
            else if (color.startsWith('#')) {
                if (color.length === 4) {
                    // Short codes: #RGB
                    const c = [color[1], color[2], color[3]].map(v =>
                        parseInt(v, 16)
                    );
                    return `${CSI}${type === 'fg' ? '3' : '4'}8;2;${c[0]};${
                        c[1]
                    };${c[2]}m`;
                } else if (color.length === 7) {
                    // Long codes: #RRGGBB
                    const c = [
                        color.slice(1, 3),
                        color.slice(3, 5),
                        color.slice(5, 7),
                    ].map(v => parseInt(v, 16));
                    return `${CSI}${type === 'fg' ? '3' : '4'}8;2;${c[0]};${
                        c[1]
                    };${c[2]}m`;
                }
            } else return '';
        };
        return console.log(
            RESET +
                fromColorCode(foreground, 'fg') +
                fromColorCode(background, 'bg') +
                text +
                RESET
        );
    }
}

class ArgvParser {
    constructor() {
        this.registered = [];
        this.arguments = [];
    }

    #resolveOptionName(n) {
        let tmp = this.#getOptionFromNameOrAlias(n);
        if (tmp) return tmp;
        if (n.startsWith('no-')) {
            tmp = this.#getOptionFromNameOrAlias(n.slice(3));
            if (tmp?.allowNegation) return tmp;
        }
        return null;
    }
    #getOptionFromNameOrAlias(name) {
        return this.registered.filter(
            v => v?.name === name || v?.alias?.includes(name)
        )[0];
    }

    /**
     * Adds a option flag to the current parser
     * @param {string} name The option long name
     * @param {{
     *  alias: string|Array<string>,
     *  allowValue: boolean,
     *  allowMultiple: boolean,
     *  allowCasting: boolean,
     *  allowNegation: boolean
     * }} options A list of possible options for controlling the parser behaviour.
     *  - alias: a string or array of strings containing aliases for the flag - usually the short name.
     *    (E.g. 'p' for option 'port')
     *  - allowValue: Defaults to true. If set to true, expects a value for the flag. Else, considers it a boolean flag
     *    (E.g. '--help' is boolean - do not expect a value).
     *  - allowMultiple: Defaults to false. If set to true, multiple uses of the same flag will add as an array. Otherwise, the last use overrides the previous.
     *  - allowCasting: Defaults to false. If set to true, tries to convert the value as a number (if possible).
     *  - allowNegation: Defaults to false. If set to true, accepts the existance of a negated prefix and a corresponding boolean value of 'false'.
     *    (E.g. '--column' may accept a negated version: '--no-column').
     * @returns {ArgvParser}
     *
     * @example <caption> Define a simple '--help' flag: </caption>
     * // A 'help' flag with short name as 'h', that does not expect a value
     * argvparser.option('help', { alias: 'h', allowValue: false });
     *
     * @example <caption> Define a more complex '--port' flag: </caption>
     * // A 'port' flag, that can be called multiple times, and is casted to a number
     * argvparser.option('port', { alias: 'p', allowMultiple: true, allowCasting: true });
     *
     * @example <caption> Define a negate-able '--column' flag: </caption>
     * // A 'column' flag, that has multiple aliases, can be negated, and does not expect a value
     * argvparser.option('column', { alias: ['c', 'C'], allowValue: false, allowNegation: true });
     *
     */
    option(
        name,
        {
            alias = [],
            allowValue = true,
            allowMultiple = false,
            allowCasting = false,
            allowNegation = false,
            allowDash = false,
        } = {}
    ) {
        this.registered.push({
            name,
            alias: typeof alias === 'string' ? [alias] : alias,
            allowValue,
            allowMultiple,
            allowCasting,
            allowNegation,
            allowDash,
        });
        return this;
    }

    /**
     * Adds a positional argument to the current parser object.
     * @param {string} name
     * @param {{allowCasting: false}} options Configuration options
     *  - allowCasting: Defaults to false. If set to true, tries to convert the value as a number (if possible).
     * @returns {ArgvParser}
     * @example <caption> A URL positional argument: </caption>
     * // The first argument in argv that does not match any option flag, will be connected with this argument name:
     * argvparser.argument('url-target');
     * // A command line like: "curl -x post http://google.com.br/" will have
     * // the 'post' value set to flag 'x', and the URL set to the argument 'url-target'
     */
    argument(name, { allowCasting = false } = {}) {
        if (!name || typeof name !== 'string')
            throw new TypeError('Argument name must be a valid string');
        this.arguments.push({ name, allowCasting });
        return this;
    }

    /**
     * Parses a command line sequence using the configured options and arguments.
     * @param {Array<string>} args Optional. An array of strings to replace the default 'process.argv.slice(2)'.
     * @returns {object} Returns the parsed option flags and arguments as as object.
     * It also includes 3 special properties:
     *  - "_": string[].    A list of unused parameters (or anything that comes after '--').
     *  - "_invalid": string[].    A list of invalid flag tokens.
     * All other properties have as keys the respective defined option flag or argument.
     */
    parseArgv(args) {
        const isOption = (v, { allowDash = false } = {}) => {
            if (!v || (allowDash && v === '-')) return false;
            if (v.startsWith('-')) return true;
            return false;
        };

        const argv = args || process.argv.slice(2);

        const params = {};
        const rest = [];
        const unknown = [];

        // Defines a breaking point for when '--' is used
        // To prevent arguments after '--' of being parsed later
        let doubleDashIndex = process.argv.length;

        for (let i = 0; i < argv.length; i++) {
            let arg = argv[i];
            let next = argv[i + 1];
            let key, value, opt;

            // Special case 1:
            // Deliberately informs that there will be no more arguments after '--'
            if (arg === '--') {
                doubleDashIndex = rest.length;
                rest.push(...argv.slice(i + 1));
                break;
            }

            // Special case 2:
            // User informs the special '-' parameter
            if (arg === '-') {
                params['-'] = true; // Add as a token of usage (even if not selected as flag)
                rest.push('-'); // Add to 'rest' queue, for usage as positional parameter
                continue;
            }

            // For multi-char flags:
            //  --port 80 , and --port=80  should be the same
            //  Also, handle negative prefix ('--no-')
            if (arg.startsWith('--')) {
                arg = arg.slice(2);

                // For concatenated flag=value: --port=80
                if (arg.includes('=')) {
                    key = arg.slice(0, arg.indexOf('='));
                    value = arg.slice(arg.indexOf('=') + 1);
                    opt = this.#resolveOptionName(key);
                    if (!opt) {
                        unknown.push(key);
                        continue;
                    }
                }

                // For no value flags:  --port
                // And for negative flags:  --no-port
                // And for postvalue flags:  --port 80
                else {
                    key = arg;
                    opt = this.#resolveOptionName(key);
                    if (!opt) {
                        unknown.push(key);
                        continue;
                    }

                    if (opt?.allowValue) {
                        if (!isOption(next, { allowDash: opt?.allowDash })) {
                            value = next ? (i++, next) : '';
                        } else {
                            value = '';
                        }
                    } else {
                        value = true;
                    }

                    if (
                        arg.startsWith('no-') &&
                        opt?.allowNegation &&
                        !opt?.name.startsWith('no-') &&
                        typeof value === 'boolean'
                    ) {
                        key = arg.slice(4);
                        value = false;
                    } else {
                        key = arg;
                    }
                }

                // Cast as number
                if (opt?.allowCasting) {
                    const asfloat = parseFloat(value);
                    value = !isNaN(asfloat) ? asfloat : value;
                }

                // Convert to long name format
                key = opt?.name || key;

                if (opt?.allowMultiple) {
                    if (params[key] === undefined) params[key] = [value];
                    else params[key].push(value);
                } else {
                    params[opt?.name || key] = value;
                }

                continue;
            }

            // For single-char flags:
            //  -p 80 , -p80 , and -p=80 should be the same
            if (arg.startsWith('-')) {
                arg = arg.slice(1);
                key = arg[0];

                let opt = this.#resolveOptionName(key);

                // For concatenated value-less flags: -abc instead of -a -b -c
                //  First we need to expand the flags into their respective slots
                if (arg.length > 1 && arg[1] !== '=' && !opt?.allowValue) {
                    // If it is a multiple flag sequence: -abc
                    // insert the rest (bc) into process argv
                    argv[i] = '-' + arg.slice(0, 1);
                    argv.splice(i + 1, 0, '-' + arg.slice(1));
                    //  And then we reset the local variables to reflect the current option
                    arg = argv[i].slice(1);
                    key = arg[0];
                    //  After the above block, the current option is no more 'abc',
                    //  it is just 'a' and 'bc' was pushed as the next argument
                    opt = this.#resolveOptionName(key);
                }

                if (!opt) {
                    unknown.push(key);
                    continue;
                }

                // For no value flags:  -p
                // And for postvalue flags:  -p 80
                if (arg.length === 1) {
                    if (opt?.allowValue) {
                        if (!isOption(next, { allowDash: opt?.allowDash })) {
                            value = next ? (i++, next) : '';
                        } else {
                            value = '';
                        }
                    } else {
                        value = true;
                    }
                }

                // For concatenated flag=value: -p=80
                else if (arg[1] === '=') {
                    value = arg.slice(2);
                }

                // For concatenated flag+value: -p80
                else if (opt?.allowValue) {
                    value = arg.slice(1);
                }

                // Cast as number
                if (opt?.allowCasting) {
                    const asfloat = parseFloat(value);
                    value = !isNaN(asfloat) ? asfloat : value;
                }

                // Convert to long name format
                key = opt?.name || key;

                if (opt?.allowMultiple) {
                    if (params[key] === undefined) params[key] = [value];
                    else params[key].push(value);
                } else {
                    params[opt?.name || key] = value;
                }

                continue;
            }

            rest.push(arg);
            continue;
        }

        for (
            let i = 0;
            i < Math.min(this.arguments.length, doubleDashIndex);
            i++
        ) {
            let argument = this.arguments[i];
            let argval = rest.shift();
            if (argument.allowCasting) {
                // Cast as number
                const asfloat = parseFloat(argval);
                argval = !isNaN(asfloat) ? asfloat : argval;
                params[argument.name] = argval;
            }
            params[argument.name] = argval;
        }

        return { _: rest, _invalid: unknown, ...params };
    }
}

/**
 * Parse control char literals in strings, converting to actual control char bytes
 * @info Specially useful for reading literals from STDIN and parsing them
 * @param {string} string The string to parse
 * @param {string} tab For enabling Tab (\b). Default: true.
 * @param {string} lf For enabling Line-Feed (\n). Default: true.
 * @param {string} cr For enabling Carriage-Return (\r). Default: true.
 * @param {string} bs For enabling Backspace (\b). Default: true.
 * @param {string} vt For enabling Vertical Tab (\f). Default: true.
 * @param {string} nul For enabling Null Byte (\0). Default: true.
 * @param {string} hex For enabling Hex-Encoded bytes (\xAB). Default: true.
 * @param {string} all For enabling all control chars. Default: true.
 * @returns {string} The string with the selected control chars enabled
 */
function parseControlChars(
    string,
    {
        tab = false, // For Tab (\b)
        lf = false, // For Line-Feed (\n)
        cr = false, // For Carriage-Return (\r)
        bs = false, // For Backspace (\b)
        vt = false, // For Vertical Tab (\f)
        nul = false, // For Null Byte (\0)
        hex = false, // For Hex-Encoded bytes (\xAB)
        all = true,
    } = {}
) {
    let out = string;
    if (all || tab) out = out.replaceAll('\\t', '\t');
    if (all || lf) out = out.replaceAll('\\n', '\n');
    if (all || cr) out = out.replaceAll('\\r', '\r');
    if (all || bs) out = out.replaceAll('\\b', '\b');
    if (all || vt) out = out.replaceAll('\\f', '\f');
    if (all || nul) out = out.replaceAll('\\0', '\0');
    if (all || hex)
        out = out.replaceAll(/\\x([a-f0-9]{1,2})/gi, (_, n1) =>
            String.fromCharCode(parseInt(n1, 16))
        );
    return out;
}

function readStdinAsync({ controlChars = false, encoding = null } = {}) {
    return new Promise((resolve, reject) => {
        const stream = process.stdin;
        const chunks = [];

        const onData = chunk => chunks.push(chunk);
        const onError = err => quit() && reject(err);
        const onEnd = () =>
            quit() &&
            resolve(
                (() => {
                    const final = Buffer.from(
                        (controlChars ? parseControlChars : v => v)(
                            Buffer.concat(chunks).toString()
                        )
                    );
                    if (encoding) return final.toString(encoding);
                    return final;
                })()
            );

        const quit = () => {
            stream.removeListener('data', onData);
            return true;
        };

        stream.on('data', onData);
        stream.once('end', onEnd);
        stream.once('error', onError);
    });
}

const isSTDINActive = () => !process.stdin.isTTY;
const fs = require('node:fs');

function tryf(func) {
    let result;
    try {
        result = func();
        return { ok: true, error: '', result };
    } catch (err) {
        return { ok: false, error: err.message, result };
    }
}

const tryReading = fname => tryf(() => fs.readFileSync(fname, 'utf-8'));
const tryWriting = (fname, data) => tryf(() => fs.writeFileSync(fname, data));
const validateFile = (fname, { throwOnMissing = true } = {}) =>
    tryf(() => {
        const exists = fs.existsSync(fname);

        // If throwOnMissing === false, we ignore if the file exists or not
        // Useful when writing (you need to know if there is access to it, but it may not exist)
        if (!throwOnMissing && !exists) return true;
        // if the file dont exist, ignore the rest of the checks

        const isFile = fs.statSync(fname).isFile();
        // the isAccessible below won't return false, it will just throw
        const access = tryf(() =>
            fs.accessSync(fname, fs.constants.W_OK | fs.constants.R_OK)
        );
        if (!exists || !isFile || !access.ok) {
            throw new Error(
                'Item is ' +
                    (!exists
                        ? 'inexistent'
                        : !access.ok
                        ? 'unreacheable'
                        : !isFile
                        ? 'not a file'
                        : '')
            );
        }
    });

module.exports = {
    ArgvParser,
    isSTDINActive,
    readStdinAsync,
    parseControlChars,
    Logger,
    tryf,
    tryReading,
    tryWriting,
    validateFile,
};
