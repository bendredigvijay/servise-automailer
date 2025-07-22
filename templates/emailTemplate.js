// templates/emailTemplate.js
const getEmailTemplate = (contact, userEmail) => {
  return `Dear ${contact.hrName},

I am excited to apply for the ${contact.jobPosition} position at ${contact.companyName}. With experience in modern web development, I have developed strong expertise in ${contact.requiredSkills.slice(0, 3).join(', ')}.

What I bring:
• ${contact.jobPosition} experience with modern technologies
• Hands-on experience in: ${contact.requiredSkills.join(', ')}
• Strong problem-solving skills and ability to deliver clean, efficient code
• Experience in building scalable web applications and RESTful APIs
• Passion for learning new technologies and staying updated with industry trends

I am particularly impressed by ${contact.companyName}'s reputation in the industry and believe my technical skills and enthusiasm would contribute to your team's success.

My resume is attached for your review. I would love to discuss how I can add value to ${contact.companyName}. I have also attached my resume for your reference - please go through it and let me know if you have any questions or need further information.

Thank you for your consideration.

Best regards,
Digvijay Bendre

📧 Email: ${userEmail}
📱 Phone: +91-7517575972 / 7843075972
🔗 LinkedIn: linkedin.com/in/digvijaybendre
🌐 GitHub: github.com/DigvijayBendre
📍 Location: Pune, Maharashtra (Open to relocation)
💼 Availability: Available for immediate joining

P.S. I'm genuinely excited about this opportunity and would welcome a conversation about how I can contribute to ${contact.companyName}'s success story!`;
};

module.exports = { getEmailTemplate };
