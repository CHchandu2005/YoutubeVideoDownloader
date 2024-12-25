const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const bodyParser = require('body-parser');

const port = 3000;
const ytdlpPath = 'yt-dlp.exe';  // Path to yt-dlp (adjust if necessary)
const ffmpegPath = path.join(__dirname, 'ffmpeg-master-latest-win64-gpl', 'bin', 'ffmpeg.exe');  // Path to ffmpeg (adjust if necessary)
const downloadFolder = path.join(__dirname, 'downloads');  // Folder where files will be saved


app.use(express.static('public'));

// Ensure download folder exists
if (!fs.existsSync(downloadFolder)) {
    fs.mkdirSync(downloadFolder);
}

// Middleware to parse form data (POST requests)
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/download', (req, res) => {
    const videoUrl = req.body.url;  // URL from form input
    const quality = req.body.quality || '1080p';  // Quality from form input (default to 1080p)

    if (!videoUrl) {
        return res.status(400).send('URL is required');
    }

    const youtubeUrlRegex = /^(https?\:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/).+$/;
    if (!youtubeUrlRegex.test(videoUrl)) {
        // If not valid, send an alert message
        return res.status(400).send('<script>alert("Enter a valid YouTube URL");  window.location.href = "/";</script>');
    }

    // Generate safe filenames using timestamp
    const timestamp = Date.now();

    // Output template for video file with '-video' suffix
    const outputTemplateVideo = path.join(downloadFolder, `${timestamp}_%(title)s-video.%(ext)s`);

    // Output template for audio file with '-audio' suffix
    const outputTemplateAudio = path.join(downloadFolder, `${timestamp}_%(title)s-audio.%(ext)s`);

    // yt-dlp command to download video
    const downloadCommandVideo = `"${ytdlpPath}" -f "bestvideo[height<=${quality}]" -o "${outputTemplateVideo}" ${videoUrl}`;

    // yt-dlp command to download audio
    const downloadCommandAudio = `"${ytdlpPath}" -f "bestaudio" -o "${outputTemplateAudio}" ${videoUrl}`;

    // Download the video
    console.log('Downloading video...');
    exec(downloadCommandVideo, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error downloading video: ${error.message}`);
            return res.status(500).send('Error downloading the video.');
        }
        console.log(`Video downloaded: ${stdout}`);
        console.error(`Video download stderr: ${stderr}`);

        // Download the audio after video is done
        console.log('Downloading audio...');
        exec(downloadCommandAudio, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error downloading audio: ${error.message}`);
                return res.status(500).send('Error downloading the audio.');
            }
            console.log(`Audio downloaded: ${stdout}`);
            console.error(`Audio download stderr: ${stderr}`);

            // After download, find the actual downloaded files
            fs.readdir(downloadFolder, (err, files) => {
                if (err) {
                    console.error(`Error reading download folder: ${err.message}`);
                    return res.status(500).send('Error processing downloaded files.');
                }

                // Filter the video and audio files by the timestamp in their filenames
                const videoFile = files.find(file => file.endsWith('.webm') && file.includes(`${timestamp}_`) && file.includes('video'));
                const audioFile = files.find(file => file.endsWith('.webm') && file.includes(`${timestamp}_`) && file.includes('audio'));

                if (!videoFile || !audioFile) {
                    return res.status(500).send('Video or audio file not found.');
                }

                // Merge the video and audio files
                if(mergeFiles(videoFile, audioFile, timestamp, res))
                {
                  return res.status(200).send('<script>windows.location.href("/");</script>')
                }
            });
        });
    });
});

// Function to merge the video and audio files using ffmpeg
const mergeFiles = (videoFile, audioFile, timestamp, res) => {
    const videoPath = path.join(downloadFolder, videoFile);
    const audioPath = path.join(downloadFolder, audioFile);

    // Final output file
    const finalFile = path.join(downloadFolder, `${timestamp}_final.mp4`);

    // Merge command using ffmpeg
    const mergeCommand = `"${ffmpegPath}" -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -strict experimental "${finalFile}"`;

    exec(mergeCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error merging files: ${error.message}`);
            return res.status(500).send('Error merging the video and audio.');
        }
        console.log(`Merge stdout: ${stdout}`);
        console.error(`Merge stderr: ${stderr}`);

        // Send the merged video file to the client
        res.download(finalFile, (err) => {
            if (err) {
                console.error(`Error sending file: ${err}`);
                return res.status(500).send('Error sending the video.');
            }

            console.log('Video sent successfully.');

            // Optionally delete the files after sending them
            cleanupFiles([videoPath, audioPath, finalFile]);
        });
    });
};

// Function to delete temporary files after sending the merged video
const cleanupFiles = (files) => {
    files.forEach((file) => {
        fs.unlink(file, (deleteErr) => {
            if (deleteErr) {
                console.error(`Error deleting file: ${deleteErr}`);
            } else {
                console.log(`File deleted: ${file}`);
            }
        });
    });
};

const nodemailer = require('nodemailer');

app.post("/contact", (req, res) => {
  console.log(req.body);

  // Create a transporter for sending emails
  const transporter = nodemailer.createTransport({
    service: 'gmail', // or any other email service
    auth: {
      user: 'chanduchintalapudi9@gmail.com', // replace with your email address
      pass: 'ewhdmvqwiaowhfvs' // replace with your email password or app-specific password
    }
  });

  // Email options
  const mailOptions = {
    from: req.body.email, // sender address
    to: 'chanduchintalapudi9@gmail.com', // receiver address
    subject: 'New Contact Form Submission', // subject line
    text: `You have received a new message from:

    Name: ${req.body.name}
    Email: ${req.body.email}
    Description: ${req.body.description}`
  };

  // Send email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      return res.status(500).send('Something went wrong while sending the email.');
    }
    
    // Send a response with a success message and redirect
    res.send(`
      <script>
        alert('Message sent successfully');
        setTimeout(function() {
          window.location.href = '/'; // Redirect after alert
        }, 10);
      </script>
    `);
  });
});



app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});








