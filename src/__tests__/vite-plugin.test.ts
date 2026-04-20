import { type Plugin } from 'vite';

import { type CMTDOptions } from '../cmtd-options.ts';
import * as findCssModulesModule from '../find-css-modules.ts';
import * as generateDeclarationFileModule from '../generate-declaration-file.ts';
import { pluginCssModuleTypeDefinitions } from '../vite-plugin.ts';

// Helper to call configureServer hook
function callConfigureServer(plugin: Plugin, server: never): void {
  if (typeof plugin.configureServer === 'function') {
    void plugin.configureServer.call({} as never, server);
  } else if (plugin.configureServer && typeof plugin.configureServer === 'object') {
    void plugin.configureServer.handler.call({} as never, server);
  }
}

// Helper to call handleHotUpdate hook
function callHandleHotUpdate(plugin: Plugin, context: never): void {
  if (typeof plugin.handleHotUpdate === 'function') {
    void plugin.handleHotUpdate.call({} as never, context);
  } else if (plugin.handleHotUpdate && typeof plugin.handleHotUpdate === 'object') {
    void plugin.handleHotUpdate.handler.call({} as never, context);
  }
}

describe('pluginCssModuleTypeDefinitions', () => {
  const mockViteDevServer = {
    config: {
      css: {
        modules: {
          localsConvention: 'camelCase' as const,
        },
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('plugin configuration', () => {
    test('should return a plugin object with correct name', () => {
      const plugin = pluginCssModuleTypeDefinitions();

      expect(plugin.name).toBe('css-module-type-definitions');
    });

    test('should have apply set to serve', () => {
      const plugin = pluginCssModuleTypeDefinitions();

      expect(plugin.apply).toBe('serve');
    });

    test('should default extension to module.css when not provided', () => {
      const findCssModulesSpy = vi
        .spyOn(findCssModulesModule, 'findCssModules')
        .mockResolvedValue([]);
      const plugin = pluginCssModuleTypeDefinitions();

      callConfigureServer(plugin, mockViteDevServer as never);

      expect(findCssModulesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: 'module.css',
        }),
      );
    });

    test('should use provided extension option', () => {
      const findCssModulesSpy = vi
        .spyOn(findCssModulesModule, 'findCssModules')
        .mockResolvedValue([]);
      const options: CMTDOptions = { extension: 'css' };
      const plugin = pluginCssModuleTypeDefinitions(options);

      callConfigureServer(plugin, mockViteDevServer as never);

      expect(findCssModulesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: 'css',
        }),
      );
    });

    test('should preserve other options', () => {
      const findCssModulesSpy = vi
        .spyOn(findCssModulesModule, 'findCssModules')
        .mockResolvedValue([]);
      const options: CMTDOptions = {
        extension: 'scss',
        rootDirectory: '/custom/root',
      };
      const plugin = pluginCssModuleTypeDefinitions(options);

      callConfigureServer(plugin, mockViteDevServer as never);

      expect(findCssModulesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: 'scss',
          rootDirectory: '/custom/root',
        }),
      );
    });
  });

  describe('configureServer', () => {
    test('should call findCssModules when css.modules is enabled', () => {
      const findCssModulesSpy = vi
        .spyOn(findCssModulesModule, 'findCssModules')
        .mockResolvedValue([]);
      const plugin = pluginCssModuleTypeDefinitions();

      callConfigureServer(plugin, mockViteDevServer as never);

      expect(findCssModulesSpy).toHaveBeenCalled();
    });

    test('should throw error when css.modules is not enabled', () => {
      const serverWithoutModules = {
        config: {
          css: {},
        },
      };
      const plugin = pluginCssModuleTypeDefinitions();

      expect(() => callConfigureServer(plugin, serverWithoutModules as never)).toThrow(
        'css.modules must be enabled in vite.config',
      );
    });

    test('should use localsConvention from Vite config when not provided in options', () => {
      const findCssModulesSpy = vi
        .spyOn(findCssModulesModule, 'findCssModules')
        .mockResolvedValue([]);
      const serverWithDashes = {
        config: {
          css: {
            modules: {
              localsConvention: 'dashes' as const,
            },
          },
        },
      };
      const plugin = pluginCssModuleTypeDefinitions();

      callConfigureServer(plugin, serverWithDashes as never);

      expect(findCssModulesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          localsConvention: 'dashes',
        }),
      );
    });

    test('should use localsConvention from options over Vite config', () => {
      const findCssModulesSpy = vi
        .spyOn(findCssModulesModule, 'findCssModules')
        .mockResolvedValue([]);
      const options: CMTDOptions = { localsConvention: 'dashesOnly' };
      const plugin = pluginCssModuleTypeDefinitions(options);

      callConfigureServer(plugin, mockViteDevServer as never);

      expect(findCssModulesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          localsConvention: 'dashesOnly',
        }),
      );
    });

    test('should default to camelCase when no localsConvention is specified', () => {
      const findCssModulesSpy = vi
        .spyOn(findCssModulesModule, 'findCssModules')
        .mockResolvedValue([]);
      const serverWithoutConvention = {
        config: {
          css: {
            modules: {},
          },
        },
      };
      const plugin = pluginCssModuleTypeDefinitions();

      callConfigureServer(plugin, serverWithoutConvention as never);

      expect(findCssModulesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          localsConvention: 'camelCase',
        }),
      );
    });

    test('should handle custom localsConvention function', () => {
      const customConvention = vi.fn((original: string) => original.toUpperCase());
      const findCssModulesSpy = vi
        .spyOn(findCssModulesModule, 'findCssModules')
        .mockResolvedValue([]);
      const options: CMTDOptions = { localsConvention: customConvention };
      const plugin = pluginCssModuleTypeDefinitions(options);

      callConfigureServer(plugin, mockViteDevServer as never);

      expect(findCssModulesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          localsConvention: customConvention,
        }),
      );
    });
  });

  describe('handleHotUpdate', () => {
    const mockHotUpdateContext = {
      file: '/path/to/styles.module.css',
      server: mockViteDevServer,
    };

    test('should call generateDeclarationFile for CSS module files', () => {
      const generateDeclarationFileSpy = vi
        .spyOn(generateDeclarationFileModule, 'generateDeclarationFile')
        .mockResolvedValue(undefined);
      const plugin = pluginCssModuleTypeDefinitions();

      callHandleHotUpdate(plugin, mockHotUpdateContext as never);

      expect(generateDeclarationFileSpy).toHaveBeenCalledWith('/path/to/styles.module.css', {
        extension: 'module.css',
      });
    });

    test('should not call generateDeclarationFile for non-CSS module files', () => {
      const generateDeclarationFileSpy = vi
        .spyOn(generateDeclarationFileModule, 'generateDeclarationFile')
        .mockResolvedValue(undefined);
      const plugin = pluginCssModuleTypeDefinitions();
      const context = {
        ...mockHotUpdateContext,
        file: '/path/to/regular.css',
      };

      callHandleHotUpdate(plugin, context as never);

      expect(generateDeclarationFileSpy).not.toHaveBeenCalled();
    });

    test('should respect custom extension in handleHotUpdate', () => {
      const generateDeclarationFileSpy = vi
        .spyOn(generateDeclarationFileModule, 'generateDeclarationFile')
        .mockResolvedValue(undefined);
      const options: CMTDOptions = { extension: 'scss' };
      const plugin = pluginCssModuleTypeDefinitions(options);
      const context = {
        ...mockHotUpdateContext,
        file: '/path/to/styles.scss',
      };

      callHandleHotUpdate(plugin, context as never);

      expect(generateDeclarationFileSpy).toHaveBeenCalledWith('/path/to/styles.scss', {
        extension: 'scss',
      });
    });

    test('should not call generateDeclarationFile when extension does not match', () => {
      const generateDeclarationFileSpy = vi
        .spyOn(generateDeclarationFileModule, 'generateDeclarationFile')
        .mockResolvedValue(undefined);
      const options: CMTDOptions = { extension: 'scss' };
      const plugin = pluginCssModuleTypeDefinitions(options);
      const context = {
        ...mockHotUpdateContext,
        file: '/path/to/styles.module.css',
      };

      callHandleHotUpdate(plugin, context as never);

      expect(generateDeclarationFileSpy).not.toHaveBeenCalled();
    });

    test('should throw error when css.modules is not enabled in handleHotUpdate', () => {
      const serverWithoutModules = {
        config: {
          css: {},
        },
      };
      const plugin = pluginCssModuleTypeDefinitions();
      const context = {
        ...mockHotUpdateContext,
        server: serverWithoutModules,
      };

      expect(() => callHandleHotUpdate(plugin, context as never)).toThrow(
        'css.modules must be enabled in vite.config',
      );
    });

    test('should pass options to generateDeclarationFile', () => {
      const generateDeclarationFileSpy = vi
        .spyOn(generateDeclarationFileModule, 'generateDeclarationFile')
        .mockResolvedValue(undefined);
      const options: CMTDOptions = {
        extension: 'module.scss',
        rootDirectory: '/custom',
        localsConvention: 'dashesOnly',
      };
      const plugin = pluginCssModuleTypeDefinitions(options);
      const context = {
        ...mockHotUpdateContext,
        file: '/path/to/styles.module.scss',
      };

      callHandleHotUpdate(plugin, context as never);

      expect(generateDeclarationFileSpy).toHaveBeenCalledWith(
        '/path/to/styles.module.scss',
        expect.objectContaining({
          extension: 'module.scss',
          rootDirectory: '/custom',
          localsConvention: 'dashesOnly',
        }),
      );
    });
  });

  describe('integration scenarios', () => {
    test('should handle empty options object', () => {
      const findCssModulesSpy = vi
        .spyOn(findCssModulesModule, 'findCssModules')
        .mockResolvedValue([]);
      const plugin = pluginCssModuleTypeDefinitions({});

      callConfigureServer(plugin, mockViteDevServer as never);

      expect(findCssModulesSpy).toHaveBeenCalledWith({
        extension: 'module.css',
        localsConvention: 'camelCase',
      });
    });

    test('should handle options being modified after plugin creation', () => {
      const generateDeclarationFileSpy = vi
        .spyOn(generateDeclarationFileModule, 'generateDeclarationFile')
        .mockResolvedValue(undefined);
      const options: CMTDOptions = { extension: 'module.css' };
      const plugin = pluginCssModuleTypeDefinitions(options);

      // Modify options after plugin creation
      options.extension = 'scss';

      const context = {
        file: '/path/to/styles.module.css',
        server: mockViteDevServer,
      };

      callHandleHotUpdate(plugin, context as never);

      // Plugin should still use original extension
      expect(generateDeclarationFileSpy).toHaveBeenCalledWith(
        '/path/to/styles.module.css',
        expect.objectContaining({
          extension: 'module.css',
        }),
      );
    });
  });
});
