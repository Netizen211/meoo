const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

/**
 * 构建时自动生成 build-meta.json（含 buildId），前端运行时通过对比此文件判断是否有新版本发布
 */
class BuildMetaPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync('BuildMetaPlugin', (compilation, callback) => {
      const buildId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      const content = JSON.stringify({ buildId });
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { RawSource } = require('webpack').sources;
      compilation.emitAsset('build-meta.json', new RawSource(content));
      callback();
    });
  }
}

module.exports = (env, argv) => {
  const isDev = argv.mode !== 'production';

  const common = {
    mode: isDev ? 'development' : 'production',
    devtool: isDev ? 'eval-source-map' : false,
    optimization: isDev ? undefined : {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.warn', 'console.info', 'console.debug']
              // keep console.error for production debugging
            },
            mangle: {
              toplevel: true,
              safari10: true
            },
            output: {
              comments: false
            }
          },
          extractComments: false
        })
      ]
    },
    module: {
      rules: [
        {
          test: /\.mjs$/,
          include: /node_modules/,
          type: 'javascript/auto',
          resolve: { fullySpecified: false },
        },
        {
          test: /\.(ts|tsx|js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-react', { runtime: 'automatic', development: isDev }],
                '@babel/preset-env',
                '@babel/preset-typescript'
              ]
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader']
        },
        {
          test: /\.(png|jpe?g|gif|webp|ico|svg)$/i,
          type: 'asset',
          parser: { dataUrlCondition: { maxSize: 8 * 1024 } }
        },
        {
          test: /\.(woff2?|eot|ttf|otf)$/i,
          type: 'asset/resource'
        },
        {
          exclude: /\.(js|jsx|ts|tsx|mjs|css|json|html)$/i,
          type: 'asset/resource'
        }
      ]
    },
    resolve: {
      extensions: ['.mjs', '.ts', '.tsx', '.js', '.jsx'],
      alias: {
        '@shared': path.resolve(__dirname, 'shared'),
      },
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
      }),
    ]
  };

  // Dev mode: dual entry with devServer
  if (isDev) {
    return {
      ...common,
      entry: {
        main: './src/index.tsx',
        admin: './src/adminIndex.tsx',
      },
      output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        publicPath: 'auto'
      },
      devServer: {
        port: 3015,
        allowedHosts: 'all',
        client: { overlay: { errors: false, warnings: false } },
        historyApiFallback: {
          index: '/index.html',
          rewrites: [
            { from: /^\/_p\/\d+\//, to: '/index.html' }
          ]
        },
        proxy: [
          {
            context: ['/api'],
            target: 'http://localhost:3007',
            changeOrigin: true,
            on: {
              proxyReq: function(proxyReq, req, _res) {
                // 透传 Authorization header
                if (req.headers['authorization']) {
                  proxyReq.setHeader('Authorization', req.headers['authorization']);
                }
              }
            }
          }
        ]
      },
      plugins: [
        ...common.plugins,
        new HtmlWebpackPlugin({
          template: './index.html',
          inject: 'body',
          filename: 'index.html',
          chunks: ['main'],
          templateParameters: {
            APP_VERSION: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          },
        }),
        new HtmlWebpackPlugin({
          template: './admin.html',
          inject: 'body',
          filename: 'admin.html',
          chunks: ['admin']
        }),
        new HtmlWebpackPlugin({
          template: './public/terms-of-service.html',
          inject: false,
          filename: 'terms-of-service.html',
          chunks: []
        }),
        new HtmlWebpackPlugin({
          template: './public/privacy-policy.html',
          inject: false,
          filename: 'privacy-policy.html',
          chunks: []
        })
      ]
    };
  }

  // Production: dual entry (user + admin)
  return [
    // 用户端
    {
      ...common,
      entry: { main: './src/index.tsx' },
      output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.[contenthash:8].js',
        chunkFilename: '[name].[contenthash:8].' + Date.now().toString(36) + '.js',
        publicPath: 'auto'
      },
      plugins: [
        ...common.plugins,
        new BuildMetaPlugin(),
        new HtmlWebpackPlugin({
          template: './index.html',
          inject: 'body',
          filename: 'index.html',
          chunks: ['main'],
          templateParameters: {
            APP_VERSION: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          },
        }),
        // 静态法律页面（不含 JS 注入）
        new HtmlWebpackPlugin({
          template: './public/terms-of-service.html',
          inject: false,
          filename: 'terms-of-service.html',
          chunks: []
        }),
        new HtmlWebpackPlugin({
          template: './public/privacy-policy.html',
          inject: false,
          filename: 'privacy-policy.html',
          chunks: []
        })
      ]
    },
    // 管理端
    {
      ...common,
      entry: { admin: './src/adminIndex.tsx' },
      output: {
        path: path.resolve(__dirname, 'dist-admin'),
        filename: 'admin.[contenthash:8].js',
        chunkFilename: '[name].[contenthash:8].' + Date.now().toString(36) + '.js',
        publicPath: 'auto'
      },
      plugins: [
        ...common.plugins,
        new BuildMetaPlugin(),
        new HtmlWebpackPlugin({
          template: './admin.html',
          inject: 'body',
          filename: 'index.html',
          chunks: ['admin']
        })
      ]
    }
  ];
};
