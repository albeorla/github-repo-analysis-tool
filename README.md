# GitHub Repository Analysis - Consolidated Application

This application provides a comprehensive GitHub repository management and analysis tool with the following features:

- View and filter your GitHub repositories
- Generate AI-powered insights about your repositories
- Archive repositories for backup
- Delete repositories you no longer need
- Analyze repository statistics and trends

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- GitHub Personal Access Token with appropriate permissions
- OpenAI API key (for repository insights)

### Environment Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file with the following variables:
   ```
   GITHUB_TOKEN=your_github_token
   OPENAI_API_KEY=your_openai_api_key
   ```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

### Building for Production

```bash
npm run build
npm start
```

## Features

### Repository Management

- View all your GitHub repositories
- Filter repositories by visibility (public/private)
- Filter repositories by activity status
- Filter repositories by primary language
- Search repositories by name

### Repository Insights

The application uses OpenAI to generate insights about your repositories, including:
- Purpose assessment
- Maintenance recommendations
- Improvement suggestions
- Potential concerns

### Repository Archiving

You can create backups of selected repositories by archiving them. The application will:
1. Clone the repositories
2. Remove .git directories to save space
3. Create a zip archive
4. Provide a download link

### Repository Deletion

You can delete repositories you no longer need. The application will:
1. Confirm your intention to delete
2. Use the GitHub API to delete the repositories
3. Provide status updates for each deletion

## API Endpoints

- `GET /api/repositories` - Get list of repositories
- `POST /api/refresh` - Refresh repository data
- `POST /api/archive` - Archive selected repositories
- `POST /api/delete` - Delete selected repositories
- `POST /api/insights` - Generate insights for a repository

## Architecture

This application is built with:
- Next.js for the frontend and API routes
- React for the UI components
- IndexedDB for client-side storage
- GitHub API for repository data
- OpenAI API for generating insights

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
