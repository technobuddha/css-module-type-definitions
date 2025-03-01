import process          from 'process';
import path             from 'path';
import sane             from 'sane';
import glob             from 'glob';
import chalk            from 'chalk';
import os               from 'os';
import fs               from 'fs-extra';
import defaultTo        from 'lodash/defaultTo';
import parser           from './parser';
import validateToken    from './validateToken';

export type CMTDOptions = {
    rootDirectoryPath?:     string;
    inputDirectoryName?:    string;
    outputDirectoryName?:   string;
    globPattern?:           string;
    dropExtensions?:        boolean;
    camelCase?:             boolean;
    logger?:                Logger;
    config?:                any;
};

export interface Logger {
    info(x: string):    void;
    warn(x: string):    void;
    error(x: string):   void;
}

export class CMTD {
    private rootDirectoryPath:      string;
    private inputDirectoryName:     string;
    private outputDirectoryName:    string;
    private globPattern:            string;
    private dropExtensions:         boolean;
    private camelCase:              boolean;
    private logger:                 Logger;
    private config:                 any;

    constructor (
        {
            rootDirectoryPath,
            inputDirectoryName,
            outputDirectoryName,
            globPattern,
            dropExtensions,
            camelCase,
            logger,
            config
        }:  CMTDOptions
    )
    {
        this.rootDirectoryPath      = defaultTo(rootDirectoryPath,      process.cwd());
        this.inputDirectoryName     = defaultTo(inputDirectoryName,     '.');
        this.outputDirectoryName    = defaultTo(outputDirectoryName,    this.inputDirectoryName);
        this.globPattern            = defaultTo(globPattern,            '**.*.css');
        this.dropExtensions         = defaultTo(dropExtensions,         false);
        this.camelCase              = defaultTo(camelCase,              false);
        this.logger                 = defaultTo(logger,                 console);
        this.config                 = defaultTo(config,                 undefined);
    }

    private async generateTypes(filePath: string) {
        return new Promise<void> (
            (resolve, _reject) => {
                parser(filePath, this.config)
                .then(
                    tokens => {
                        const fileName              = path.isAbsolute(filePath) ? path.relative(this.inputDirectoryName, filePath) : filePath;
                        const outputDirectoryPath   = path.resolve(this.rootDirectoryPath, this.outputDirectoryName);
                        const outputFileBase        = this.dropExtensions ? CMTD.removeExtension(fileName) : fileName;
                        const outputFilePath        = path.join(outputDirectoryPath, outputFileBase + '.d.ts');

                        const declarations: string[]    = [];
                        Array.from(tokens.keys()).sort().forEach(
                            token => {
                                let key   = token;
                                let valid = validateToken(key);

                                if (this.camelCase) {
                                    const camelKey = CMTD.toCamelCase(key);

                                    if (camelKey !== key) {
                                        declarations.push(`'${key}'`);
                                        key     = camelKey;
                                        valid   = validateToken(key);
                                    }
                                }

                                if (valid.isValid === true)
                                    declarations.push(`'${key}'`);
                                else {
                                    declarations.push(`'${key}'`);
                                    this.logger.warn(`{CMTD} ${chalk.yellow(`${fileName}: ${valid.message}`)}`);
                                }
                            }
                        );

                        if (!CMTD.exists(outputDirectoryPath))
                            fs.mkdirpSync(outputDirectoryPath);

                        var fileContent = [
                            '/*',
                            ' *  This file is automatically generated by css-module-type-definitions',
                            ' */',
                            '',
                        ];

                        if(declarations.length) {
                            fileContent = fileContent.concat([
                                `export type Keys = ${declarations.join(` | `)};`,
                                'export type Css = { [key in Keys]: string };',
                            ]);
                        } else {
                            fileContent = fileContent.concat([
                                'export type Keys = never;',
                                'export type Css = never;',
                            ]);
                        }

                        fileContent = fileContent.concat([
                            '',
                            'declare const css: Css;',
                            'export default css;',
                        ]);

                        let   existing: string        = '';
                        const replacement: string     = fileContent.join(os.EOL) + os.EOL;
                        if (fs.existsSync(outputFilePath)) {
                            existing = fs.readFileSync(outputFilePath, 'utf8');
                        }

                        if (existing === replacement)
                            resolve();
                        else {
                            fs.writeFile(
                                outputFilePath,
                                replacement,
                                'utf8'
                            ).then (
                                () => {
                                    this.logger.info(`{CMTD} ${chalk.green('Types Generated for')} ${fileName}`);
                                    resolve();
                                }
                            );
                        }
                    }
                )
                .catch(err => { this.logger.error(`{CMTD} ${err} ${JSON.stringify(err)}`); });
            }
        );
    }

    public scan() {
        return new Promise(
            (resolve, reject) => {
                glob(
                    path.join(path.resolve(this.rootDirectoryPath, this.inputDirectoryName), this.globPattern),
                    (err, files) => {
                        if (err)
                            reject(err);
                        else {
                            Promise.all(files.map(f => this.generateTypes(f)))
                            .then(resolve)
                            .catch(err => { this.logger.error(`{CMTD} ${JSON.stringify(err)}`); reject(err); });
                        }
                    }
                );
            }
        );
    }

    public watch() {
        const DELAY     = 10;       // Number of milliseconds to delay for file to finish writing
        const target    = path.resolve(this.rootDirectoryPath, this.inputDirectoryName);

        this.logger.info(`{CMTD} ${chalk.blue('Watching')} ${this.inputDirectoryName} ${this.globPattern}`);

        const watcher   = sane(target, { glob: this.globPattern });

        watcher.on('add',    (f) => this.generateTypes(path.join(target, f)));
        watcher.on('change', (f) => setTimeout(() => this.generateTypes(path.join(target, f)), DELAY));
    }

    private static removeExtension(filePath: string) {
        const ext = path.extname(filePath);
        return filePath.replace(new RegExp(ext + '$'), '');
    }

    private static exists(pathname: string): boolean {
        try {
            fs.statSync(pathname);
            return true;
        } catch {
            return false;
        }
    }

    private static toCamelCase(str: string) {
        return str.replace(/-+(\w)/g, (_match, firstLetter) => firstLetter.toUpperCase());
    }
}

export { CMTDWebpackPlugin } from './webpack-plugin';
export default CMTD;
