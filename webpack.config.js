const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const Reloader = require('advanced-extension-reloader-watch-2/umd/reloader');

const extension_id = 'MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDUmxNXVcb08zzShADvnAVJNuKQvfybnc9cBrgmcDtR9NYg3aWqYQH08P/UFdv65EtcDzBt8mJqyoaPVbO+TfTA2VBlDabxm5eofw5pNERKg9jif4PJSYPNMVTWHONBd8giW2XPKHv6Zb8UW2Zlo4DaUoqcrcgxXZT0e8o5xUpJn8su5nb7NJb/WQmS9rPiCexbu/0OFuzVZpOArveyHK3cxKLVHNsvevXEc6ZRV6ZW7CxnY7Nk1OBv8uyurj0rh3pysa9+2ubC6SosbXQCro/9rAjx4GII3t7iDUXF1feVrU6K6sahZzSpP4FfwyPEEtFbwQC0v+b1PMkGMmF7i9EfAgMBAAECggEAR2w7YKUb3BFU1wHqkJRRAEoUbfytPpgS378QITWl7//46XycmXLSZfeKcjTPvGbyXCBsLBt37ZlRABkR87Ybqae3xuMBuPwExGG+tSAOaxwFAf5FhxsP0KCod++ndshnLweWWbQnhjSlLxEPgsidUnrVPxJwhQkDr+hgRO0e6kFL+rmvIRiEZLfD2ymIJ/HbtUgARJA9jZbDIW/jy3Q6PiLH+UxvtYbA+Qo9ragLsBoxCeNtpLTSTjbOmiC1YXlRkNT8EMHDDeOQwhhtpv2keT/gTW4yjnRmkhgYRZT0Es9zoFi8Dzry4tHD/lZcr142fHDbzIOiKCD5uv/sicQ6oQKBgQDxHJiGt0uzrAF/H6QUu68ZN2EEdRb9dNqHiwD0hcDZPlFucS54lNuUczrGas3qgL/CAm5mQn5rm0NpfnkNBtyg30stlRyQU5b/Ms7Yal9f33L+O70DIjt9gih6mswT/za6mzTIsAVL2wkgB32JY7IVbEIQP5yWco1L2B+SoYY9YQKBgQDhu95TlFwTzeU9f+S+GNlfWLTVslAiqDLgqW5lFe3BUw/Z2c05GXyFPkc7cjfh/DV7yFcN9acxWW/k2YIpt4K0e1qXH/iVK4fJezIi7ha98o6UemC91r/hIiSo9p5cTwXNVqzggge90iERp0/9+GqSo18ZmnyZ5rAAkpe3pAIefwKBgQDigJiQxZRqH0XwpErB52aga7PKOiz0wVehSWYGT7hQ3QgmllCvmjeFB5LJXwA+MeDyYtJPYlvcvqjfa55QLIgK4HmBQrjopH4PEy3ZhGRAbmtahcgUL45vY1yfgNgCWRiSyMcXWLRBBG1YF3FJJczf7ylIllmFw+sUut0+JFs1QQKBgQDWL1Q9KcBUakDhocCBP0LB3YF4YsD2oXHlCd7du3jkvtODec3oJ+6m3vjnxvCPVKfK08UGUdhaUuqA0oFW4/D5HzJNwuAzaiJlYqenzRF3Gfd/mr7AYkueaq8uQxLvs2tl8qAGRlriGceW4JJeAJ/ek3Vg7dzciq7lXDLo5I2+MQKBgQCCGVh3FQT3YqcgFgVzPd/6odG57wBBvURMMCMDklMxveA+Q/SdS+4TShWngetbCqoHMs/OWuUTL216humAWHTC6ylNZ1Pf1gGwuIJTtB4keTL/CkkOlq1qHatw3EGiyXDndoijy7eVMtDhfK6qnoRu+WuwUmVGkXOXGWB12J648w==';

const reloader = new Reloader({
  port: 6220,
});

reloader.watch();

module.exports = {
  entry: './src/content.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'content.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'icons', to: 'icons' },
        { from: 'src/pdf.js', to: 'pdf.js' },
        { from: 'src/popup.js', to: 'popup.js' },
        { from: 'src/*.html', to: '[name][ext]' },
        // Add more patterns as needed
      ],
    }),
    {
      apply: (compiler) => {
        console.log('apply');
        compiler.hooks.done.tap('done', (stats) => {
          const an_error_occured = stats.compilation.errors.length !== 0;

          if (an_error_occured) {
            reloader.play_error_notification({ extension_id });
            console.log('error');
          } else {
            reloader.reload({
              extension_id,
              play_notifications: true,
            });
            console.log('reload');
          }
        });
      },
    },
  ],
};