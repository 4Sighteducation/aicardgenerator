const express = require('express');
const router = express.Router();
const axios = require('axios');

// Ensure PROGRESSIER_API is loaded from environment variables on your Heroku backend
const PROGRESSIER_BEARER_TOKEN = process.env.PROGRESSIER_API;
const PROGRESSIER_API_ENDPOINT = 'https://progressier.app/q4j11iLHdvCqYbNjbcrR/send';

router.post('/', async (req, res) => {
  console.log('Backend: Received request on /api/send-due-notification');

  if (!PROGRESSIER_BEARER_TOKEN) {
    console.error('Backend: Progressier API token (PROGRESSIER_API) is not configured on the server.');
    return res.status(500).json({ status: 'error', error: 'Notification service is not configured on server.' });
  }

  const { userEmail, appUrlToOpen } = req.body;

  if (!userEmail) {
    console.warn('Backend: Missing userEmail in request to /api/send-due-notification');
    return res.status(400).json({ status: 'error', error: 'Recipient email is required.' });
  }

  if (!appUrlToOpen) {
    console.warn('Backend: Missing appUrlToOpen in request to /api/send-due-notification');
    return res.status(400).json({ status: 'error', error: 'Application URL to open is required.' });
  }

  const notificationPayload = {
    recipients: {
      email: userEmail
    },
    title: "VESPA Flashcards Reminder ⚡",
    body: "You have flashcards due for review. Time to boost your memory!",
    url: appUrlToOpen,
    // Optional: Add direct URLs to your app icon/badge if desired
    // icon: "https://your-app-domain.com/icon.png",
    // badge: "https://your-app-domain.com/badge.png"
  };

  console.log('Backend: Sending notification to Progressier with payload:', JSON.stringify(notificationPayload, null, 2));

  try {
    const progressierResponse = await axios.post(
      PROGRESSIER_API_ENDPOINT,
      notificationPayload,
      {
        headers: {
          'Authorization': \`Bearer \${PROGRESSIER_BEARER_TOKEN}\`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (progressierResponse.data && progressierResponse.data.status === 'success') {
      console.log('Backend: Successfully sent notification via Progressier:', progressierResponse.data);
      return res.status(200).json({ status: 'success', message: 'Notification successfully queued with Progressier.' });
    } else {
      console.warn('Backend: Progressier responded without explicit success status:', progressierResponse.data);
      return res.status(200).json({ 
        status: 'partial_success', 
        message: 'Notification request sent, but Progressier status was not "success".', 
        details: progressierResponse.data 
      });
    }

  } catch (error) {
    console.error('Backend: Error sending notification via Progressier:');
    if (error.response) {
      console.error('Backend Error Data:', error.response.data);
      console.error('Backend Error Status:', error.response.status);
      return res.status(error.response.status || 500).json({
        status: 'error',
        error: 'Failed to send notification via Progressier.',
        progressierError: error.response.data
      });
    } else if (error.request) {
      console.error('Backend Request Error:', error.request);
      return res.status(500).json({ status: 'error', error: 'No response from Progressier service.' });
    } else {
      console.error('Backend General Error:', error.message);
      return res.status(500).json({ status: 'error', error: 'Internal server error preparing notification request.' });
    }
  }
});

module.exports = router; 