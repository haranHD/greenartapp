import { Platform, AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';
import App from './App';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  AppRegistry.registerComponent('main', () => App);
  const rootTag = document.getElementById('root');
  if (rootTag) {
    AppRegistry.runApplication('main', {
      rootTag,
      mode: 'concurrent',
    });
  }
} else {
  registerRootComponent(App);
}
