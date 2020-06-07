import fs                   from 'fs-extra';
import postcss              from 'postcss';
import { cosmiconfigSync }  from 'cosmiconfig';

// TODO this could proably use some better type definitions, but I can't find them :(
const explorer  = cosmiconfigSync('postcss');
const found     = explorer.search();
const config    = found!.config;

export const importer       = require('postcss-import')(config.plugins['postcss-import'])   as postcss.AcceptedPlugin;
export const localByDefault = require('postcss-modules-local-by-default')                   as postcss.AcceptedPlugin;
export const scope          = require('postcss-modules-scope')                              as postcss.AcceptedPlugin;
export const comment        = require('postcss-comment')                                    as postcss.Parser;                                    

export const defaultPlugins = [ importer, localByDefault, scope ];

export type ParserReturn    = Set<string>;

export async function parser(
    filePath:   string,
    plugins:    postcss.AcceptedPlugin[] | null = null,
):  Promise<ParserReturn> {
    const exportTokens  = new Set<string>();

    const gatherPlugIn =  (root: postcss.Root) => {
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
