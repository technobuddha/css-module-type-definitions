import fs                   from 'fs-extra';
import { cosmiconfigSync }  from 'cosmiconfig';
import postcss, { AcceptedPlugin, Parser, Root } from 'postcss';

export type ParserReturn    = Set<string>;

export async function parser(
    filePath:   string,
    config:     any,
    plugins:    AcceptedPlugin[] | null = null,
):  Promise<ParserReturn> {
    // TODO config is 'any' this could probably use some better type definitions, but I can't find them :(
    if(config === undefined) {
        config = cosmiconfigSync('postcss').search()?.config ?? {};
    }
    console.log(config);

    const importer       = require('postcss-import')(config.plugins['postcss-import'])   as AcceptedPlugin;
    const localByDefault = require('postcss-modules-local-by-default')                   as AcceptedPlugin;
    const scope          = require('postcss-modules-scope')                              as AcceptedPlugin;
    const comment        = require('postcss-comment')                                    as Parser;                                    

    const defaultPlugins = [ importer, localByDefault, scope ];

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
