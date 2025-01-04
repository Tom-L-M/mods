const {
    ArgvParser,
    isSTDINActive,
    readStdinAsync,
    tryReading,
    tryWriting,
    validateFile,
} = require('../shared');

const help = `
    [srt2vtt-js]
        A command line utility for converting subtitles format in NodeJS.

    Usage:
        node srt2vtt [options] [file]
      OR
        <stdin> | node srt2vtt [options] [file]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -r | --vtt2srt          Converts from WEBVTT to SRT instead.
        -o | --output <FILE>    Saves the converted data to a file.
                                set <FILE> to "-" to output to stdout.`;

function convertSRTtoVTT(sourceData) {
    console.log(98, sourceData);
    const srtBuffer = sourceData;
    const lines = srtBuffer.split('\n');
    const vttBuffer = ['WEBVTT', '']; // Add the "WEBVTT" signature at the top
    for (let line of lines) {
        line = line.trim();
        if (line[2] === ':' && line[5] === ':') {
            line = line.replaceAll(',', '.');
        }
        vttBuffer.push(line);
    }
    return vttBuffer.join('\n');
}

function convertVTTtoSRT(sourceData) {
    const vttBuffer = sourceData;
    const lines = vttBuffer.trimStart().split('\n').slice(1); // Remove the "WEBVTT" signature at the top
    const srtBuffer = [''];
    for (let line of lines) {
        line = line.trim();
        if (line[2] === ':' && line[5] === ':') {
            line = line.replaceAll('.', ',');
        }
        srtBuffer.push(line);
    }
    return srtBuffer.join('\n').trimStart();
}

(async function () {
    const fromSTDIN = isSTDINActive();

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('vtt2srt', { alias: 'r', allowValue: false });
    parser.option('output', { alias: 'o' });
    parser.argument('source');
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!fromSTDIN && !args.source)) return console.log(help);

    if (args._invalid.length > 0)
        return console.log(
            `[x] Error: invalid parameters [ ${args._invalid.join(', ')} ]`
        );

    let sourceCheck = validateFile(args.source);
    if (args.source && !sourceCheck.ok) {
        return console.log(
            `Error: Invalid file provided as source (${args.source}) - ${sourceCheck.error}`
        );
    }

    let outputCheck = validateFile(args.source);
    if (args.output && args.output !== '-' && !outputCheck.ok) {
        return console.log(
            `Error: Invalid file provided as output destination (${args.output}) - ${outputCheck.error}`
        );
    }

    let sourcedata = null;
    if (fromSTDIN) {
        sourcedata = await readStdinAsync();
    } else {
        let readingResult = tryReading(args.source);
        if (!readingResult) {
            return console.log(
                `Error: Invalid file provided as source (${args.source}) - ${readingResult.error}`
            );
        }
        sourcedata = readingResult.result;
    }

    let result = null;
    if (args.vtt2srt) {
        result = convertVTTtoSRT(sourcedata);
    } else {
        result = convertSRTtoVTT(sourcedata);
    }

    if (args.output === '-' || !args.output) {
        return console.log(result);
    } else {
        let writingResult = tryWriting(args.output, result);
        if (!writingResult) {
            return console.log(
                `Error: Invalid file provided as output destination (${args.output}) - ${writingResult.error}`
            );
        }
    }
})();
