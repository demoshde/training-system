# Training System - MERN Stack

A comprehensive training platform built with MongoDB, Express.js, React, and Node.js.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB |
| **Authentication** | JWT |

## Features

### Admin Panel
- ✅ Create, edit, delete training modules
- ✅ Rich text slide editor with drag-and-drop ordering
- ✅ PDF/Image upload support
- ✅ Quiz question management
- ✅ Worker management
- ✅ Company & department management
- ✅ Results reporting with export
- ✅ News/announcements system
- ✅ Polls & surveys

### Worker Portal
- ✅ Clean slide-based training viewer
- ✅ Progress tracking
- ✅ Quiz with randomized questions and answers
- ✅ Certificate generation
- ✅ Mobile-friendly responsive design

### Quiz System
- ✅ Questions randomly ordered for each worker
- ✅ Answer options shuffled for each question
- ✅ Configurable passing scores
- ✅ Instant results feedback

## Project Structure

```
training/
├── mern/
│   ├── client/          # React frontend
│   │   ├── src/
│   │   │   ├── api/         # API service functions
│   │   │   ├── components/  # Reusable components
│   │   │   ├── contexts/    # React contexts
│   │   │   ├── pages/       # Page components
│   │   │   └── App.jsx      # Main app component
│   │   ├── package.json
│   │   └── vite.config.js
│   │
│   └── server/          # Express backend
│       ├── models/          # Mongoose models
│       ├── routes/          # API routes
│       ├── middleware/      # Auth middleware
│       ├── uploads/         # Uploaded files
│       ├── server.js        # Entry point
│       └── package.json
│
└── README.md
```

## Installation

### Prerequisites
- Node.js 18+ 
- MongoDB (local or Atlas)
- npm or yarn

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd training
   ```

2. **Install server dependencies**
   ```bash
   cd mern/server
   npm install
   ```

3. **Configure environment variables**
   Create `mern/server/.env`:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/training_system
   JWT_SECRET=your_jwt_secret_key
   ```

4. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   ```

5. **Seed the database (optional)**
   ```bash
   cd ../server
   npm run seed
   ```

## Running the Application

### Development Mode

**Start the backend server:**
```bash
cd mern/server
npm run dev
```
Server runs on `http://localhost:5000`

**Start the frontend (new terminal):**
```bash
cd mern/client
npm run dev
```
Client runs on `http://localhost:5173`

### Production Build

**Build the client:**
```bash
cd mern/client
npm run build
```

**Start production server:**
```bash
cd mern/server
npm start
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Worker login |
| POST | `/api/admin/login` | Admin login |

### Trainings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/trainings` | List all trainings |
| POST | `/api/trainings` | Create training |
| PUT | `/api/trainings/:id` | Update training |
| DELETE | `/api/trainings/:id` | Delete training |

### Workers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workers` | List all workers |
| POST | `/api/workers` | Create worker |
| PUT | `/api/workers/:id` | Update worker |
| DELETE | `/api/workers/:id` | Delete worker |

### Enrollments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/enrollments` | List enrollments |
| POST | `/api/enrollments` | Create enrollment |
| PUT | `/api/enrollments/:id` | Update enrollment |

## Database Backup & Restore

**Create backup:**
```bash
cd mern/server
node backup.js
```

**Restore from backup:**
```bash
cd mern/server
node restore.js
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `MONGODB_URI` | MongoDB connection string | - |
| `JWT_SECRET` | Secret for JWT tokens | - |

## License

MIT License
   - Filter by training, status, date
   - Export to CSV

### Worker Workflow

1. Select training from home page
2. View all slides (minimum time enforced)
3. Enter SAP number and name
4. Take quiz (randomized questions/answers)
5. View instant results

## Database Schema

### Key Tables
- `trainings` - Training modules
- `training_slides` - Slide content
- `quiz_questions` - Quiz questions
- `quiz_answers` - Answer options (4 per question)
- `workers` - Worker records
- `quiz_attempts` - Quiz attempt records
- `quiz_responses` - Individual answer responses

### Important: Answer Validation

The system validates answers by **answer ID**, not letter position:

```php
// Correct way (what this system does)
$isCorrect = ($selectedAnswerId == $correctAnswerId);

// Wrong way (don't do this)
$isCorrect = ($selectedLetter == 'A');  // Breaks with shuffle!
```

## Customization

### Changing Quiz Settings
Edit `config/app.php`:
```php
define('DEFAULT_PASSING_SCORE', 80);     // Default pass percentage
define('MAX_QUESTIONS_PER_QUIZ', 10);    // Max questions per quiz
define('MIN_SLIDE_VIEW_TIME', 10);       // Min seconds per slide
```

### Styling
Edit `assets/css/worker.css` for worker portal styles.
Admin styles are inline in `admin/includes/header.php`.

## Security Notes

1. Change default admin password immediately
2. Use HTTPS in production
3. Set proper file permissions
4. Database credentials in config should be protected
5. Session cookies are HTTP-only by default

## File Structure

```
training/
├── admin/
│   ├── ajax/
│   │   └── get_attempt_details.php
│   ├── includes/
│   │   ├── header.php
│   │   └── footer.php
│   ├── index.php          # Dashboard
│   ├── login.php
│   ├── logout.php
│   ├── trainings.php      # Training management
│   ├── slides.php         # Slide editor (text/PDF/PPT)
│   ├── questions.php      # Quiz editor
│   └── results.php        # Reports
├── ajax/
│   ├── save_answer.php
│   └── track_slide.php
├── assets/
│   └── css/
│       └── worker.css
├── config/
│   ├── app.php
│   └── database.php
├── database/
│   └── schema.sql
├── uploads/
│   └── trainings/         # PDF/PPT uploads stored here
├── index.php              # Worker home
├── training.php           # Slide viewer (supports PDF/PPT)
├── sap_form.php           # Worker registration
├── quiz.php               # Quiz interface
├── submit_quiz.php        # Quiz submission
├── results.php            # Worker results
├── .htaccess
└── README.md
```

## PDF/PPT Upload Feature

### Supported File Types
- **PDF** - Displayed directly in an embedded viewer
- **PPT/PPTX** - Provides download link for workers

### How to Upload
1. Go to Admin → Slides
2. Select a training module
3. Click "Upload PDF/PPT" button
4. Choose file type (PDF or PowerPoint)
5. Select your file (max 50MB)
6. Set minimum view time (recommended 30+ seconds)
7. Upload

### Best Practices
- Convert PowerPoint to PDF for in-browser viewing
- Use meaningful slide titles
- Set appropriate minimum view times based on content length
- Organize slides in logical order using drag-and-drop

## Support

For issues or questions, contact your system administrator.

## License

Internal use only. All rights reserved.
