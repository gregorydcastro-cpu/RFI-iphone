/**
 * /contact, /help, /faq, /contact-us, /support-center, /docs, /status,
 * /blog, /changelog, /news, /press, /roadmap, /guides, /resources,
 * /case-studies, /testimonials, /webinar, /events, /contact-sales, /sales,
 * /enterprise, /community, /forum, /developers, /api-docs, /help-center,
 * /knowledge-base, /kb, /tutorials, /academy, /training, /webinars, /video,
 * /videos, /newsletter, /podcast, /media, /media-kit, /press-kit, /brand,
 * /talk-to-sales, /sales-contact, /helpdesk, /ticket, /submit-ticket,
 * /feedback, /report-bug, /bug-report, /feature-request, /ideas,
 * /community-forum, /contact/support, /support/contact, /developer,
 * /api-reference, /status-page, /uptime, /system-status, /contactus,
 * /get-in-touch, /reach-us, /customer-support, /customer-service,
 * /knowledgebase, /faqs, /how-to, /documentation, /manual, /billing-help,
 * and /whats-new have no page.
 * Each is a permanent move straight to the public support page, not to
 * another alias. Next.js treats permanent as HTTP 308.
 * Each source is that exact path. A longer path such as /blog/post is not
 * a match. /api-docs does not match /api or /api/docs.
 * /help-center does not match /help. /knowledge-base does not match /kb.
 * /webinars does not match /webinar. /videos does not match /video.
 * /media-kit does not match /media. /press-kit does not match /press.
 * /contact/support and /support/contact do not match /contact or /support.
 * /developer does not match /developers. /community-forum does not match
 * /community. /status-page and /system-status do not match /status.
 * /sales-contact does not match /sales. /talk-to-sales does not match
 * /contact-sales. /api-reference does not match /api-docs, /api, or
 * /api/docs. /bug-report does not match /report-bug. /submit-ticket does
 * not match /ticket.
 * /contactus does not match /contact or /contact-us. /faqs does not match
 * /faq. /knowledgebase does not match /knowledge-base or /kb.
 * /customer-support does not match /customer-service or /support.
 * /how-to does not match /how-it-works. /documentation does not match
 * /docs. /billing-help does not match /billing. /whats-new does not match
 * /news. /get-in-touch and /reach-us do not match /contact.
 * /contact-form, /contact-us-form, /support-ticket, /help-desk,
 * /helpdesk-support, /customer-care, /care-center, /ask, /ask-us,
 * /talk-to-us, /message-us, /write-us, /email-us, /call-us, /knowledge,
 * /service-desk, /faq-page, /common-questions, /troubleshooting, /fix-it,
 * /howto, /blog-posts, /press-release, /newsroom, /updates, and
 * /api-status use that same hop. /contact-form does not match /contact.
 * /contact-us-form does not match /contact-us. /support-ticket does not
 * match /ticket or /submit-ticket. /help-desk does not match /help,
 * /help-center, or /helpdesk. /helpdesk-support does not match /helpdesk.
 * /customer-care does not match /customer-service or /customer-support.
 * /ask does not match /ask-us. /knowledge does not match /knowledge-base,
 * /knowledgebase, or /kb. /faq-page does not match /faq or /faqs.
 * /howto does not match /how-to. /blog-posts does not match /blog.
 * /press-release does not match /press. /newsroom does not match /news.
 * /updates does not match /whats-new. /api-status does not match /status,
 * /api, /api-docs, or /api/docs.
 * /contact-support, /get-support, /tech-support, /technical-support,
 * /sales-team, /sales-inquiry, /support-home, /client-support,
 * /api-docs-page, /developer-docs, /help-center-home, /brand-assets,
 * /kb-home, /knowledge-base-home, /faq-center, /brand-guidelines, and
 * /media-assets use that same hop. /contact-support does not match
 * /contact or /support. /get-support does not match /support.
 * /tech-support and /technical-support do not match each other or
 * /support. /sales-team and /sales-inquiry do not match /sales.
 * /support-home does not match /support. /client-support does not match
 * /customer-support. /api-docs-page does not match /api-docs, /api, or
 * /api/docs. /developer-docs does not match /developer, /developers, or
 * /docs. /help-center-home does not match /help-center or /help.
 * /brand-assets and /brand-guidelines do not match /brand.
 * /kb-home does not match /kb. /knowledge-base-home does not match
 * /knowledge-base. /faq-center does not match /faq. /media-assets does
 * not match /media.
 * /faq-help, /learn, /feedback-form, and /sdk use that same hop.
 * /faq-help does not match /faq or /help. /learn does not match
 * /guides or /how-to. /feedback-form does not match /feedback.
 * /sdk does not match /docs, /developers, or /api.
 * /suport, /hepl, /fqa, /documenation, /knowlege-base, /helpcentre,
 * /helpcenter, /whatsnew, /frequently-asked-questions, and /release-notes
 * use that same hop. /suport does not match /support. /hepl does not
 * match /help. /fqa does not match /faq. /documenation does not match
 * /documentation. /knowlege-base does not match /knowledge-base or /kb.
 * /helpcentre and /helpcenter do not match /help-center or /help.
 * /whatsnew does not match /whats-new or /news.
 * /frequently-asked-questions does not match /faq or /faqs.
 * /release-notes does not match /changelog or /news.
 * /get-help, /user-guide, /user-manual, /support-page, /contact-page,
 * /help-page, /docs-page, /knowledge-center, /press-room, /brand-kit,
 * /forums, /feature-requests, /podcasts, /case-study, /troubleshoot,
 * /reach-out, /api-documentation, /changelog-page, /blog-page, /faq-home,
 * /report-issue, and /testimonials-page use that same hop.
 * /get-help does not match /help or /get-support. /user-guide does not
 * match /guides. /user-manual does not match /manual. /support-page does
 * not match /support-home or /support-center. /contact-page does not
 * match /contact. /help-page does not match /help. /docs-page does not
 * match /docs. /knowledge-center does not match /knowledge-base or /kb.
 * /press-room does not match /press or /newsroom. /brand-kit does not
 * match /brand, /press-kit, or /media-kit. /forums does not match /forum.
 * /feature-requests does not match /feature-request. /podcasts does not
 * match /podcast. /case-study does not match /case-studies.
 * /troubleshoot does not match /troubleshooting. /reach-out does not
 * match /reach-us. /api-documentation does not match /api-docs,
 * /documentation, /api, or /api/docs. /changelog-page does not match
 * /changelog. /blog-page does not match /blog. /faq-home does not match
 * /faq, /faq-center, or /kb-home. /report-issue does not match
 * /report-bug. /testimonials-page does not match /testimonials.
 * /support.html, /help.html, /faq.html, /contact.html, /suppport,
 * /help-centre, /frequentlyaskedquestions, /getting-help, and
 * /help-and-support use that same hop. /support.html does not match
 * /support. /help.html does not match /help. /faq.html does not match
 * /faq. /contact.html does not match /contact. /suppport does not match
 * /support or /suport. /help-centre does not match /helpcentre,
 * /help-center, or /help. /frequentlyaskedquestions does not match
 * /frequently-asked-questions, /faq, or /faqs. /getting-help does not
 * match /get-help or /help. /help-and-support does not match /help or
 * /support.
 * /docs.html, /guides.html, /documentation.html, /help-center.html,
 * /contact-us.html, /support-centre, /contct, and /docss use that same hop.
 * /docs.html does not match /docs. /guides.html does not match /guides.
 * /documentation.html does not match /documentation or /docs.html.
 * /help-center.html does not match /help-center or /help.html.
 * /contact-us.html does not match /contact-us or /contact.html.
 * /support-centre does not match /support, /help-centre, or /support-center.
 * /contct does not match /contact. /docss does not match /docs or /docs.html.
 * /blog.html and /status.html stay off this list. /blog.html does not
 * match /blog. /status.html does not match /status. /statuspage stays off
 * this list.
 */

const SUPPORT_HREF = "/support";

export function contactRedirects(): Array<{
  source: string;
  destination: string;
  permanent: boolean;
}> {
  return [
    "/contact",
    "/help",
    "/faq",
    "/contact-us",
    "/support-center",
    "/docs",
    "/status",
    "/blog",
    "/changelog",
    "/news",
    "/press",
    "/roadmap",
    "/guides",
    "/resources",
    "/case-studies",
    "/testimonials",
    "/webinar",
    "/events",
    "/contact-sales",
    "/sales",
    "/enterprise",
    "/community",
    "/forum",
    "/developers",
    "/api-docs",
    "/help-center",
    "/knowledge-base",
    "/kb",
    "/tutorials",
    "/academy",
    "/training",
    "/webinars",
    "/video",
    "/videos",
    "/newsletter",
    "/podcast",
    "/media",
    "/media-kit",
    "/press-kit",
    "/brand",
    "/talk-to-sales",
    "/sales-contact",
    "/helpdesk",
    "/ticket",
    "/submit-ticket",
    "/feedback",
    "/report-bug",
    "/bug-report",
    "/feature-request",
    "/ideas",
    "/community-forum",
    "/contact/support",
    "/support/contact",
    "/developer",
    "/api-reference",
    "/status-page",
    "/uptime",
    "/system-status",
    "/contactus",
    "/get-in-touch",
    "/reach-us",
    "/customer-support",
    "/customer-service",
    "/knowledgebase",
    "/faqs",
    "/how-to",
    "/documentation",
    "/manual",
    "/billing-help",
    "/whats-new",
    "/contact-form",
    "/contact-us-form",
    "/support-ticket",
    "/help-desk",
    "/helpdesk-support",
    "/customer-care",
    "/care-center",
    "/ask",
    "/ask-us",
    "/talk-to-us",
    "/message-us",
    "/write-us",
    "/email-us",
    "/call-us",
    "/knowledge",
    "/service-desk",
    "/faq-page",
    "/common-questions",
    "/troubleshooting",
    "/fix-it",
    "/howto",
    "/blog-posts",
    "/press-release",
    "/newsroom",
    "/updates",
    "/api-status",
    "/contact-support",
    "/get-support",
    "/tech-support",
    "/technical-support",
    "/sales-team",
    "/sales-inquiry",
    "/support-home",
    "/client-support",
    "/api-docs-page",
    "/developer-docs",
    "/help-center-home",
    "/brand-assets",
    "/kb-home",
    "/knowledge-base-home",
    "/faq-center",
    "/brand-guidelines",
    "/media-assets",
    "/faq-help",
    "/learn",
    "/feedback-form",
    "/sdk",
    "/suport",
    "/hepl",
    "/fqa",
    "/documenation",
    "/knowlege-base",
    "/helpcentre",
    "/helpcenter",
    "/whatsnew",
    "/frequently-asked-questions",
    "/release-notes",
    "/get-help",
    "/user-guide",
    "/user-manual",
    "/support-page",
    "/contact-page",
    "/help-page",
    "/docs-page",
    "/knowledge-center",
    "/press-room",
    "/brand-kit",
    "/forums",
    "/feature-requests",
    "/podcasts",
    "/case-study",
    "/troubleshoot",
    "/reach-out",
    "/api-documentation",
    "/changelog-page",
    "/blog-page",
    "/faq-home",
    "/report-issue",
    "/testimonials-page",
    "/support.html",
    "/help.html",
    "/faq.html",
    "/contact.html",
    "/suppport",
    "/help-centre",
    "/frequentlyaskedquestions",
    "/getting-help",
    "/help-and-support",
    "/docs.html",
    "/guides.html",
    "/documentation.html",
    "/help-center.html",
    "/contact-us.html",
    "/support-centre",
    "/contct",
    "/docss",
  ].map((source) => ({
    source,
    destination: SUPPORT_HREF,
    permanent: true,
  }));
}
