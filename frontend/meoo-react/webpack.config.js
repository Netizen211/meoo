const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

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
        }
      },
      plugins: [
        ...common.plugins,
        new HtmlWebpackPlugin({
          template: './index.html',
          inject: 'body',
          filename: 'index.html',
          chunks: ['main']
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
        publicPath: 'auto'
      },
      plugins: [
        ...common.plugins,
        new HtmlWebpackPlugin({
          template: './index.html',
          inject: 'body',
          filename: 'index.html',
          chunks: ['main']
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
        publicPath: 'auto'
      },
      plugins: [
        ...common.plugins,
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
