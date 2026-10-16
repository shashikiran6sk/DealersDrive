const { withMainActivity } = require('expo/config-plugins');
const marker =
  '  override fun onNewIntent(intent: Intent) {\n    setIntent(intent)\n    super.onNewIntent(intent)\n  }';

function retainIntent(source) {
  if (source.includes(marker)) return source;
  if (source.includes('override fun onNewIntent('))
    throw new Error('Review the existing MainActivity intent handler before applying retention.');
  const anchor = 'class MainActivity : ReactActivity() {';
  if (!source.includes(anchor) || !source.includes('import android.os.Build'))
    throw new Error('Unsupported MainActivity template; native intent retention must be reviewed.');
  return source
    .replace('import android.os.Build', 'import android.content.Intent\nimport android.os.Build')
    .replace(anchor, `${anchor}\n${marker}\n`);
}

module.exports = function withRetainedIntent(config) {
  return withMainActivity(config, (mod) => {
    if (mod.modResults.language !== 'kt') throw new Error('Expected a Kotlin MainActivity.');
    mod.modResults.contents = retainIntent(mod.modResults.contents);
    return mod;
  });
};
module.exports.retainIntent = retainIntent;
