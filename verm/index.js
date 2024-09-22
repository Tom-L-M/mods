const fs = require('node:fs');
const path = require('node:path');

// Set error and help messages
const help = `
    [verm-js]
        A package version manager - can change and control version files from command line

    Usage:
        verm [-h] [-v] <operation> [-f] [-p [file][:version-field]]
        
    -h | --help         Prints the help message and quits.
    -v | --version      Prints the version info and quits.

    - <operation> may be:
        +   Increase 'minor' version field
        ++  Increase 'middle' version field
        +++ Increase 'major' version field
        -   Decrease 'minor' version field
        --  Decrease 'middle' version field
        --- Decrease 'major' version field
        =   Print current version field
        x   Set version to a semver compliant version [x]

    - [-p] or [--paths] must be a string of file paths to change, separated by commas

    - If no file is provided, the default file to search for will be 'package.json'
    
    - (Warn: By using [-f] or [--force] semver compliance is ignored, be careful)

    - Any file can be used in [-p], but the file must contain valid JSON 
      and either a root-level 'version' field or a proper field must be specified

    Examples:
        - Updating minor version of default 'package.json' file:
            verm +
        
        - Downgrading major version of a custom '.example.json' file:
            verm --- -p .example.json
        
        - Upgrading middle version of a custom 'publish.json' file in field 'last-version'
            verm ++ -p publish.json:last-version

        - Setting version to 1.2.3:
            verm 1.2.3 -p package.json
        
        - Setting an non-semver-compliant version on package.json:
            verm 1.a.f.8 -f`;
const validateSemver = version => /[0-9+]+\.[0-9+]+\.[0-9]+/gim.test(version);

function changeversion(operationToken, currentVersion) {
    let version = currentVersion.split('.');

    switch (operationToken) {
        // Increase 'minor' field in 1
        // keep the rest as it is
        case '+':
            version[2]++;
            break;

        // Increase 'middle' field in 1 and reset 'minor' field
        case '++':
            version[1]++;
            version[2] = 0;
            break;

        // Increase 'major' field in 1 and reset 'minor' and 'middle' fields
        case '+++':
            version[0]++;
            version[1] = 0;
            version[2] = 0;
            break;

        // Decrease 'minor' field in 1
        // keep the rest as it is
        case '-':
            // Only decreases field if it is higher than 0
            if (version[2] > 0) version[2]--;
            break;

        // Decrease 'middle' field in 1 and reset 'minor' field
        case '--':
            // Only decreases field if it is higher than 0
            if (version[1] > 0) version[1]--;
            version[2] = 0;
            break;

        // Decrease 'major' field in 1 and reset 'minor' and 'middle' fields
        case '---':
            // Only decreases field if it is higher than 0
            if (version[0] > 0) version[0]--;
            version[1] = 0;
            version[2] = 0;
            break;

        // Dont change the version fields
        case '=':
            break;

        // Set the version to the one provided
        default:
            version = operationToken.split('.');
    }

    return version.join('.');
}

function JSONSafeParse(data) {
    try {
        return JSON.parse(data);
    } catch (err) {
        return false;
    }
}

const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

function printVersion() {
    try {
        console.log(require(exeresolve('verm/package.json')).version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

(function main() {
    // Get args as: script <operation> [files]
    const args = process.argv.slice(2);
    const op = args[0] || '--help';
    const force = args.includes('--force') || args.includes('-f');

    // Check if there are no arguments
    if (args.length == 0 || args.includes('-h') || args.includes('--help'))
        return console.log(help);

    // Check if there are no arguments
    if (args.includes('-v') || args.includes('--version'))
        return printVersion();

    // Special case:        'node verm <file>' (forgot operation)
    if (
        !['=', '+++', '++', '+', '---', '--', '-'].includes(op) &&
        !validateSemver(op) &&
        !force
    ) {
        console.log(
            `<> Error: version [${op}] is not semver-compliant and '--force' is disabled`
        );
        return;
    }

    // Warn user if 'force' option is used
    if (force)
        console.log(
            'Warn: <force> option enabled, you may invalidate version field, be careful'
        );

    // Check for a file specified
    let file = 'package.json';
    if (args.includes('--paths') || args.includes('-p')) {
        let index =
            args.indexOf('--paths') >= 0
                ? args.indexOf('--paths')
                : args.indexOf('-p');
        file = args[index + 1];
    }

    // Check if the specified file includes a particular field
    let field = 'version';
    if (file.includes(':')) [file, field] = file.split(':');

    // Check if file exists
    let oldversion = null;
    const filepath = path.join(process.cwd(), file);
    if (fs.existsSync(filepath) && fs.statSync(filepath).isFile()) {
        // Check if file has a proper field for version
        const filecontent = JSONSafeParse(fs.readFileSync(filepath, 'utf-8'));
        if (!filecontent)
            return console.log(
                `<> Error: Could not parse contents of file [${filepath}], invalid JSON found`
            );
        if (!filecontent[field])
            return console.log(
                `<> Error: Selected field [${field}] is not present on file [${filepath}]`
            );

        if (!validateSemver(filecontent[field]))
            return console.log(
                `<> Error: Selected field includes non-semver-compliant data and therefore cannot be parsed`
            );

        oldversion = filecontent[field];

        filecontent[field] = changeversion(op, filecontent[field]);

        if (!validateSemver(filecontent[field]) && !force)
            return console.log(
                `<> Error: Provided version change [${filecontent[field]}] is non-semver-compliant and '--force' is disabled`
            );

        // Everything alright and was not read-only : then save it
        let returnstr;
        if (op !== '=') {
            fs.writeFileSync(filepath, JSON.stringify(filecontent, null, '\t'));
            returnstr = `${filepath}: (${field}) [${oldversion}] => [${filecontent[field]}]`;
        } else {
            returnstr = `${filepath}: (${field}) [${filecontent[field]}]`;
        }

        // Print return string
        console.log(returnstr);
    } else {
        if (!fs.existsSync(filepath)) {
            return console.log(`<> Error: File [${filepath}] does not exist`);
        } else {
            return console.log(`<> Error: Entity [${filepath}] is not a file`);
        }
    }
})();

/*

 // If file does not exists, return error
    let currentfile = process.cwd() + '\\' + filesToUse[i];
    if (!fs.existsSync(currentfile)) continue;

    // If files exists, read and parse it as JSON
    let data = fs.readFileSync(currentfile);
    try { 
        data = JSON.parse(data); 
    } catch (err) { 
        console.log("Warn: "+ currentfile +" does not contains valid JSON");
        continue;
    }

    // Check if the file includes a 'version' field
    if (!data.version) {
        console.log("Warn: "+ currentfile +" does not contains a valid 'version' field");
        continue;
    }

    // Check validity of 'version' field value
    if (!data.version.toString().match(regexp) && !force) {
        console.log("Warn: "+ currentfile +" does not contains a valid semver compliant 'version' field");
        continue;
    }

        // Set return string
        let retstr;
        if (oldversion == newversion) retstr = `${currentfile}: [${oldversion}]`;
        else retstr = `${currentfile}: [${oldversion}] => [${newversion}]`;

        // Update version in file:
        data.version = newversion;
        fs.writeFileSync(currentfile, JSON.stringify(data, null, '\t'));

        // Print return string
        console.log(retstr);
*/
