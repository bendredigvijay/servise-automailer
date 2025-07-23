// templates/emailTemplate.js - Updated with User Profile Support
const getEmailTemplate = (contact, userProfile) => {
  // Default values if userProfile is not provided
  const senderName = userProfile?.fullName || 'Digvijay Bendre';
  const senderEmail = userProfile?.email || 'digvijaybendre@gmail.com';
  const senderPhone = userProfile?.phone || '+91-7517575972 / 7843075972';
  const senderLinkedIn = userProfile?.linkedin || 'linkedin.com/in/digvijaybendre';
  const senderGitHub = userProfile?.github || 'github.com/DigvijayBendre';
  const senderLocation = userProfile?.location || 'Pune, Maharashtra (Open to relocation)';
  const senderAvailability = userProfile?.availability || 'Available for immediate joining';
  const experienceYears = userProfile?.experienceYears || '2+ years';
  const currentRole = userProfile?.currentRole || contact.jobPosition;
  
  // Skills handling
  let skillsDisplay = '';
  if (userProfile?.skills && userProfile.skills.length > 0) {
    skillsDisplay = userProfile.skills.join(', ');
  } else {
    skillsDisplay = contact.requiredSkills.join(', ');
  }
  
  const topSkills = contact.requiredSkills.slice(0, 3).join(', ');
  
  return `Dear ${contact.hrName},

I am excited to apply for the ${contact.jobPosition} position at ${contact.companyName}. With ${experienceYears} of experience as a ${currentRole}, I have developed strong expertise in ${topSkills}.

What I bring:
• ${experienceYears} experience with modern technologies  
• Hands-on experience in: ${skillsDisplay}
• Strong problem-solving skills and ability to deliver clean, efficient code
• Experience in building scalable web applications and RESTful APIs
• Passion for learning new technologies and staying updated with industry trends

I am particularly impressed by ${contact.companyName}'s reputation in the industry and believe my technical skills and enthusiasm would contribute to your team's success.

My resume is attached for your review. I would love to discuss how I can add value to ${contact.companyName}. Please go through it and let me know if you have any questions or need further information.

Thank you for your consideration.

Best regards,
${senderName}

📧 Email: ${senderEmail}
📱 Phone: ${senderPhone}
🔗 LinkedIn: ${senderLinkedIn}
🌐 GitHub: ${senderGitHub}
📍 Location: ${senderLocation}
💼 Availability: ${senderAvailability}

P.S. I'm genuinely excited about this opportunity and would welcome a conversation about how I can contribute to ${contact.companyName}'s success story!`;
};

module.exports = { getEmailTemplate };
