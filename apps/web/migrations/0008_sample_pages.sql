INSERT OR IGNORE INTO pages (slug, title, published, template_id, template_content, excerpt, body, cover_image) VALUES
  (
    'about',
    'About',
    1,
    NULL,
    '{}',
    'Learn more about this blog and the person behind it.',
    '<h2>Hello, and welcome</h2><p>This blog is a place for stories, notes and ideas worth sharing. Pull up a chair and have a look around.</p><h3>What you will find here</h3><ul><li>Long-form posts and personal reflections</li><li>Quick notes and links</li><li>Photos and media from recent projects</li></ul><p>Thanks for stopping by!</p>',
    NULL
  ),
  (
    'contact',
    'Contact',
    0,
    NULL,
    '{}',
    'Get in touch with questions, feedback or collaboration ideas.',
    '<h2>Get in touch</h2><p>Have a question, a suggestion or just want to say hello? I would love to hear from you.</p><p>Send a message to <a href="mailto:hello@example.com">hello@example.com</a> and I will reply as soon as I can.</p>',
    NULL
  );
