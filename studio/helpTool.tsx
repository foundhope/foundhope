// "How to" tab in the Studio: shows the editors' guide from foundhope.store/help.
import { HelpCircleIcon } from '@sanity/icons/HelpCircle'

export const helpTool = {
  name: 'how-to',
  title: 'How to',
  icon: HelpCircleIcon,
  component: () => (
    <iframe
      src="/help?in-studio=1"
      title="How to update the website"
      style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
    />
  ),
}
