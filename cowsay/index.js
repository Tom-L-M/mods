const fs = require('node:fs');
const path = require('node:path');
const PROPS = require('./props.json');
const SKINS_DIR = path.join(__dirname, 'skins');
const { ArgvParser, isSTDINActive, readStdinAsync } = require('../shared');

const ERROR = {
    E_NO_SKIN_DIR: s => `Error: Invalid skins directory "${s}"`,
    E_NO_SKIN: s => `Error: Missing selected skin "${s}"`,
};

const tryf = f => {
    try {
        return f();
    } catch {
        return null;
    }
};

function listSkins() {
    return tryf(() => fs.readdirSync(SKINS_DIR));
}

function getExternalSkin(skin) {
    return tryf(() => fs.readFileSync(path.resolve(skin), 'utf-8'));
}

function getLocalSkin(skin) {
    return tryf(() => fs.readFileSync(path.join(SKINS_DIR, skin), 'utf8'));
}

function foldStringIntoArray(message, wrap) {
    // No wrap text
    if (typeof wrap !== 'number' || isNaN(wrap)) {
        // Break lines and replace tabs by spaces
        return message
            .split(/\r\n|[\n\r\f\v\u2028\u2029\u0085]/g)
            .map(function (line) {
                // Find tabs
                var tab = line.indexOf('\t');

                if (tab === -1) {
                    return line;
                }

                // Replace tabs
                var tabbed = line;

                do {
                    var spaces = Array(9 - (tab % 8)).join(' ');
                    tabbed =
                        tabbed.slice(0, tab) + spaces + tabbed.slice(tab + 1);
                    tab = tabbed.indexOf('\t', tab + spaces.length);
                } while (tab !== -1);

                return tabbed;
            });
    }

    // Fix tabs, breaklines and split lines
    var lines = message
        .replace(/(?:\r\n|[\n\r\f\v\u2028\u2029\u0085])(\S)/g, ' $1')
        .replace(/(?:\r\n|[\n\r\f\v\u2028\u2029\u0085])\s+/g, '\n\n')
        .replace(/(?:\r\n|[\t\n\r\f\v\u2028\u2029\u0085])$/g, ' ')
        .split(/\r\n|[\n\r\f\v\u2028\u2029\u0085]/g);

    // Process lines
    lines = lines
        .map(function (line, i) {
            // Empty line
            if (/^\s*$/.test(line)) {
                return '';
            }

            // Remove duplicated spaces and trim left for non first line
            var fixed = line.replace(/\s+/g, ' ');
            return i > 0 ? fixed.replace(/^\s+/, '') : fixed;
        })
        .filter(function (line, i, lines) {
            // Allways allow not empty lines and the first line
            if (line.length > 0 || i <= 1) {
                return true;
            }

            // Remove duplicated empty lines
            return lines[i - 1].length > 0;
        });

    // Check empty message
    if (
        lines.every(function (line) {
            return line.length === 0;
        })
    ) {
        return [''];
    }

    // Trim last empty line
    if (lines[lines.length - 1].length === 0) {
        lines.pop();
    }

    /** @type{string[]} */
    var initial = [];
    var max = wrap;
    var col = wrap - 1;

    // Wrap words
    return lines.reduce(function (acc, line, i, src) {
        // Empty line
        if (line.length === 0) {
            return acc.concat(line);
        }

        // Too small word wrap column or invalid value
        if (max < 2) {
            // Ends if the next line is not empty
            if (src[i + 1] !== '') {
                src.splice(0);
            }

            // Add a "0" character and continue like wraping at second column
            max = 2;
            col = 1;
            return acc.concat('0');
        }

        // Get break position
        var last = i > 0 ? acc[acc.length - 1] + line : line;
        var space =
            last.length < max ? last.length : last.lastIndexOf(' ', col);
        var br =
            space > 0 && space < col
                ? space
                : last.length === max && last[last.length - 1] === ' '
                ? max
                : col;

        // Wrap line
        var words = acc.concat(last.slice(0, br));
        var rest = line.slice(br).replace(/^\s+/, '');

        // Wrap rest of line
        while (rest.length > 0) {
            space =
                rest.length < max ? rest.length : rest.lastIndexOf(' ', col);
            br =
                space > 0 && space < col
                    ? space
                    : rest.length === max && rest[rest.length - 1] === ' '
                    ? max
                    : col;

            words.push(rest.slice(0, br));
            rest = rest.slice(br).replace(/^\s+/, '');
        }

        // Return words
        return words;
    }, initial);
}

function justify(string, length) {
    // To center the string, instead of justifying, use this:
    // const pre = ' '.repeat(Math.floor((length - string.length) / 2));
    // const post = ' '.repeat(Math.ceil((length - string.length) / 2));
    // return pre + string + post;
    return string.padEnd(length);
}

function renderBalloon(
    string,
    { maxLength = 40, style = 'default', noWrap = false }
) {
    const lines = foldStringIntoArray(string, noWrap ? null : maxLength + 1);
    const longest = Math.max(...lines.map(v => v.length));
    const isMultiline = lines.length > 1;

    let roof, floor, endlines;

    if (style === 'default' || style === 'say') {
        roof = ' ' + '_'.repeat(longest + 2) + ' \n';
        floor = '\n ' + '-'.repeat(longest + 2) + ' ';
        if (isMultiline) {
            endlines = lines.map((v, i, a) => {
                if (i === 0) return '/ ' + justify(v, longest) + ' \\';
                if (i === a.length - 1)
                    return '\\ ' + justify(v, longest) + ' /';
                return '| ' + justify(v, longest) + ' |';
            });
        } else {
            endlines = lines.map(v => '< ' + justify(v, longest) + ' >');
        }
    }

    if (style === 'modern') {
        roof = '┌' + '─'.repeat(longest + 2) + '┐\n';
        floor = '\n└' + '─'.repeat(longest + 2) + '┘';
        endlines = lines.map(v => '│ ' + justify(v, longest) + ' │');
    }

    if (style === 'think' || style === 'dream') {
        roof = ' ' + '_'.repeat(longest + 2) + ' \n';
        floor = '\n ' + '-'.repeat(longest + 2) + ' ';
        endlines = lines.map(v => '( ' + justify(v, longest) + ' )');
    }

    if (style === 'box') {
        roof = '+' + '-'.repeat(longest + 2) + '+\n';
        floor = '\n+' + '-'.repeat(longest + 2) + '+';
        endlines = lines.map(v => '| ' + justify(v, longest) + ' |');
    }

    return roof + endlines.join('\n') + floor;
}

function renderSkin(
    skin,
    string,
    { prop, maxLength, eyes, tongue, style, noWrap } = {}
) {
    let skindata;

    const skinlist = listSkins();
    if (skinlist === null) return ERROR.E_NO_SKIN_DIR(SKINS_DIR);
    if (!skinlist.includes(skin)) skindata = getExternalSkin(skin);
    else skindata = getLocalSkin(skin);

    if (skindata === null) return ERROR.E_NO_SKIN(skin);

    const propdefault = PROPS['default'];
    const propdata =
        prop && typeof prop === 'string'
            ? PROPS[prop.toLowerCase()]
            : propdefault;
    const combined = { ...propdefault, ...propdata };
    let result = skindata;

    if (eyes && typeof eyes === 'string') {
        result = result.replaceAll('{$eye1}', eyes[0]);
        result = result.replaceAll('{$eye2}', eyes[1]);
    }

    if (tongue && typeof tongue === 'string') {
        result = result.replaceAll('{$tongue}', tongue);
    }

    if (style && style === 'think') {
        result = result
            .replaceAll(/\{\$tl\} /gim, '()')
            .replaceAll(/\{\$tr\} /gim, '()');
    }

    for (let key in combined) {
        result = result.replaceAll(`{$${key}}`, combined[key]);
    }

    result = result.replaceAll(
        '{$balloon}',
        renderBalloon(string, { maxLength, style, noWrap })
    );

    return result.trimEnd();
}

const help = `
    [cowsay-js]
        A "cowsay" command line utility in NodeJS.

    Usage:
        node cowsay [options] [string]
      OR
        <stdin> | node cowsay [options]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -l | --list             Do not print string, instead print skins available.
        -n | --no-wrap          Prevents line-wrapping (good for recursion).
        -W | --width N          Specifies width of the speech balloon (default: 40).
        -f | --file N           Specified a local or external skin name/file.
        -e | --eyes             Specifies a 2-chars-long string to use as the eyes.
        -T | --tongue           Specifies a 2-chars-long string to use as the tongue.

      Balloon Style:
        -M | --modern           Uses modern box-building ASCII chars.
        -B | --box              Uses regular box-building ASCII chars.
        -D | --dream | --think  Uses a "thinking" balloon (round walls).

      Cow Style:
        -b | --borg             "Borg mode", uses '==' for the eyes.
        -d | --dead             "Dead", uses 'XX' for the eyes, plus a 'U' tongue.
        -g | --greedy           "Greedy", uses '$$' for the eyes.
        -p | --paranoid         "Paranoid", uses '@@' for the eyes.
        -s | --stoned           "Stoned", uses '**' for the eyes, plus a 'U' tongue.
        -t | --tired            "Tired", uses '--' for the eyes.
        -w | --wired            "Wired", uses 'OO' for the eyes.
        -y | --youthful         "Youthful", uses '..' for smaller eyes.

    Examples:
        STDIN reading with the Tux skin:
            echo hello | node cowsay -f tux

        Using an extenal custom skin file:
            node cowsay -f ../some/skin.txt "something to say"`;

(async function () {
    const fromSTDIN = isSTDINActive();

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('list', { alias: 'l', allowValue: false });
    parser.option('no-wrap', { alias: 'n', allowValue: false });
    parser.option('width', { alias: 'w', allowCasting: true });
    parser.option('file', { alias: 'f' });
    parser.option('eyes', { alias: 'e' });
    parser.option('tongue', { alias: 'T' });

    parser.option('borg', { alias: 'b', allowValue: false });
    parser.option('dead', { alias: 'd', allowValue: false });
    parser.option('greedy', { alias: 'g', allowValue: false });
    parser.option('paranoid', { alias: 'p', allowValue: false });
    parser.option('stoned', { alias: 's', allowValue: false });
    parser.option('tired', { alias: 't', allowValue: false });
    parser.option('wired', { alias: 'w', allowValue: false });
    parser.option('youthful', { alias: 'y', allowValue: false });

    parser.option('modern', { alias: 'M', allowValue: false });
    parser.option('box', { alias: 'B', allowValue: false });
    parser.option('think', { alias: ['D', 'dream'], allowValue: false });

    parser.argument('string');

    const args = parser.parseArgv();

    if (args.help || (!fromSTDIN && !args.string && !args.list))
        return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    const input = fromSTDIN
        ? (await readStdinAsync()).toString('utf8').trimEnd()
        : args.string || '';

    const skin = args.file || 'cow';
    const listing = Boolean(args.list);

    const prop = args.borg
        ? 'borg'
        : args.dead
        ? 'dead'
        : args.greedy
        ? 'greedy'
        : args.paranoid
        ? 'paranoid'
        : args.stoned
        ? 'stoned'
        : args.tired
        ? 'tired'
        : args.wired
        ? 'wired'
        : args.youthful
        ? 'youthful'
        : 'default';

    const style = args.modern
        ? 'modern'
        : args.think
        ? 'think'
        : args.box
        ? 'box'
        : 'default';

    if (listing)
        return console.log(
            foldStringIntoArray(listSkins().join(' '), 80).join('\n')
        );

    console.log(
        renderSkin(skin, input, {
            noWrap: args['no-wrap'],
            maxLength: args.width,
            eyes: args.eyes,
            tongue: args.tongue,
            prop,
            style,
        })
    );
})();
