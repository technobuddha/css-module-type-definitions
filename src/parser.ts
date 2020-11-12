import fs                   from 'fs-extra';
import { cosmiconfigSync }  from 'cosmiconfig';
import postcss, { AcceptedPlugin, Parser, Root } from 'postcss';

// TODO this could proably use some better type definitions, but I can't find them :(
const explorer  = cosmiconfigSync('postcss');
const found     = explorer.search();
const config    = found!.config;

export const importer       = require('postcss-import')(config.plugins['postcss-import'])   as AcceptedPlugin;
export const localByDefault = require('postcss-modules-local-by-default')                   as AcceptedPlugin;
export const scope          = require('postcss-modules-scope')                              as AcceptedPlugin;
export const comment        = require('postcss-comment')                                    as Parser;                                    

export const defaultPlugins = [ importer, localByDefault, scope ];

export type ParserReturn    = Set<string>;

export async function parser(
    filePath:   string,
    plugins:    AcceptedPlugin[] | null = null,
):  Promise<ParserReturn> {
    const exportTokens  = new Set<string>();

    const gatherPlugIn =  (root: Root) => {
        root.each(
            node => {
                if (node.type === 'rule' && node.selector === ':export') {
                    node.each(
                        child => {
                            if (child.type === 'decl')
                                exportTokens.add(child.prop);
                        }
                    );
                }
            }
        );
    };

    return new Promise<ParserReturn> (
        (resolve, reject) => {
            fs.readFile(filePath, 'utf-8').then(
                source => {
                    postcss((plugins || defaultPlugins).concat([ gatherPlugIn ]))
                    .process(source, {
                        from: filePath,
                        parser: comment,
                    }).then(_result => resolve(exportTokens)).catch(reject);
                }
            ).catch(reject);
        }
    );
}

export default parser;
