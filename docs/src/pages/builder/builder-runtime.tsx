import { createRoot } from 'react-dom/client';
import { BuilderDocument } from './BuilderDocument';
import { validateBuilderData } from './builder-model';
import { BuilderPrototype, validatePrototype } from './BuilderPrototype';

const element = document.getElementById('zui-page-root');
const payload = document.getElementById('zui-page-data');
if (element && payload) {
  try {
    const input = JSON.parse(payload.textContent || '{}');
    if (input.format === 'zui-prototype')
      createRoot(element).render(<BuilderPrototype prototype={validatePrototype(input)} />);
    else createRoot(element).render(<BuilderDocument data={validateBuilderData(input)} />);
  } catch (reason) {
    element.textContent =
      reason instanceof Error ? `页面无法载入：${reason.message}` : '页面无法载入。';
    element.setAttribute('role', 'alert');
  }
}
