import type { Metadata } from 'next';
import ContactForm from '@/components/nihongo/contact-form';

export const metadata: Metadata = {
  title: 'Contact us',
  description: 'Share a suggestion, report a problem or send feedback to the Nihongo Labs team.',
};

export default function ContactPage() {
  return <ContactForm />;
}
