import { chromium, Page, BrowserContext, Browser } from 'playwright';

export interface Assignment {
  id: string;
  title: string;
  course: string;
  dueDate: Date | null;
  description: string;
  submissionStatus: 'pending' | 'submitted' | 'graded' | 'overdue';
  link: string;
}

export interface Grade {
  id: string;
  course: string;
  assignment: string;
  grade: string;
  maxGrade: string;
  percentage: number | null;
  feedback: string;
  gradedDate: Date | null;
}

export interface Course {
  id: string;
  name: string;
  shortName: string;
  link: string;
}

export interface MoodleCredentials {
  username: string;
  password: string;
}

export class MoodleClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isLoggedIn: boolean = false;
  private readonly baseUrl: string = 'https://lms.uptacloban.edu.ph';

  constructor() {}

  /**
   * Initialize browser and login
   */
  async initialize(credentials: MoodleCredentials, headless: boolean = true): Promise<void> {
    try {
      this.browser = await chromium.launch({ 
        headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });

      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US'
      });

      this.page = await this.context.newPage();
      await this.login(credentials);
    } catch (error) {
      await this.cleanup();
      throw new Error(`Failed to initialize Moodle client: ${error}`);
    }
  }

  /**
   * Login to Moodle with CSRF handling
   */
  private async login(credentials: MoodleCredentials): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      // Navigate to login page
      await this.page.goto(`${this.baseUrl}/login/index.php`, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      // Wait for login form
      await this.page.waitForSelector('form#login', { timeout: 10000 });

      // Extract CSRF token if present
      let loginToken = null;
      try {
        const tokenInput = this.page.locator('input[name="logintoken"]');
        if (await tokenInput.count() > 0) {
          loginToken = await tokenInput.getAttribute('value');
        }
      } catch (e) {
        // CSRF token might not be present in all Moodle versions
      }

      // Fill login form
      await this.page.fill('input[name="username"]', credentials.username);
      await this.page.fill('input[name="password"]', credentials.password);

      // Submit form
      await this.page.click('input[type="submit"], button[type="submit"]');

      // Wait for redirect and check for successful login
      await this.page.waitForLoadState('networkidle', { timeout: 15000 });

      // Check if login was successful by looking for dashboard elements
      const currentUrl = this.page.url();
      
      if (currentUrl.includes('/login/') || currentUrl.includes('error')) {
        // Check for error messages
        const errorElement = await this.page.locator('.alert-danger, .error, #loginerrormessage').first();
        let errorText = 'Unknown login error';
        
        if (await errorElement.count() > 0) {
          errorText = await errorElement.textContent() || errorText;
        }
        
        throw new Error(`Login failed: ${errorText}`);
      }

      // Verify we're on dashboard or my page
      if (!currentUrl.includes('/my/') && !currentUrl.includes('/dashboard/')) {
        // Try to navigate to dashboard to verify login
        await this.page.goto(`${this.baseUrl}/my/`, { timeout: 15000 });
      }

      this.isLoggedIn = true;
    } catch (error) {
      throw new Error(`Login failed: ${error}`);
    }
  }

  /**
   * Get list of enrolled courses
   */
  async getCourses(): Promise<Course[]> {
    if (!this.page || !this.isLoggedIn) {
      throw new Error('Not logged in to Moodle');
    }

    try {
      // Navigate to courses overview or dashboard
      await this.page.goto(`${this.baseUrl}/my/courses.php`, { 
        waitUntil: 'networkidle',
        timeout: 15000 
      });

      // Wait for course list to load
      await this.page.waitForTimeout(2000);

      const courses: Course[] = [];

      // Try multiple selectors for different Moodle themes
      const courseSelectors = [
        '.course-info-container a',
        '.coursebox .info h3 a',
        '.card-deck .card .card-body a',
        '[data-region="course-content"] a'
      ];

      for (const selector of courseSelectors) {
        const courseElements = this.page.locator(selector);
        const count = await courseElements.count();
        
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const element = courseElements.nth(i);
            const title = await element.textContent();
            const link = await element.getAttribute('href');
            
            if (title && link && title.trim() !== '') {
              // Extract course ID from URL
              const idMatch = link.match(/[?&]id=(\d+)/);
              const courseId = idMatch ? idMatch[1] : `course-${i}`;
              
              courses.push({
                id: courseId,
                name: title.trim(),
                shortName: title.trim().substring(0, 20),
                link: link.startsWith('http') ? link : `${this.baseUrl}${link}`
              });
            }
          }
          
          if (courses.length > 0) break; // Found courses with this selector
        }
      }

      return courses;
    } catch (error) {
      throw new Error(`Failed to get courses: ${error}`);
    }
  }

  /**
   * Get assignments from all courses
   */
  async getAssignments(): Promise<Assignment[]> {
    if (!this.page || !this.isLoggedIn) {
      throw new Error('Not logged in to Moodle');
    }

    try {
      const assignments: Assignment[] = [];
      
      // Try to get assignments from calendar/timeline view first
      try {
        await this.page.goto(`${this.baseUrl}/calendar/view.php?view=upcoming`, { 
          timeout: 10000 
        });
        
        const upcomingAssignments = await this.parseCalendarAssignments();
        assignments.push(...upcomingAssignments);
      } catch (e) {
        // Calendar view might not be available, continue with course-by-course approach
      }

      // If we didn't get assignments from calendar, try the dashboard timeline
      if (assignments.length === 0) {
        try {
          await this.page.goto(`${this.baseUrl}/my/`, { 
            waitUntil: 'networkidle',
            timeout: 15000 
          });
          
          const dashboardAssignments = await this.parseDashboardAssignments();
          assignments.push(...dashboardAssignments);
        } catch (e) {
          // Dashboard might not show assignments clearly
        }
      }

      // If still no assignments, get courses and check each one
      if (assignments.length === 0) {
        const courses = await this.getCourses();
        
        for (const course of courses.slice(0, 5)) { // Limit to 5 courses to avoid timeout
          try {
            const courseAssignments = await this.getCourseAssignments(course);
            assignments.push(...courseAssignments);
          } catch (e) {
            console.warn(`Failed to get assignments for course ${course.name}: ${e}`);
          }
        }
      }

      return assignments;
    } catch (error) {
      throw new Error(`Failed to get assignments: ${error}`);
    }
  }

  /**
   * Parse assignments from calendar view
   */
  private async parseCalendarAssignments(): Promise<Assignment[]> {
    if (!this.page) return [];

    const assignments: Assignment[] = [];
    
    // Wait for calendar events
    await this.page.waitForTimeout(2000);
    
    const eventSelectors = [
      '.calendar-event-panel',
      '.event',
      '[data-type="assignment"]'
    ];
    
    for (const selector of eventSelectors) {
      const events = this.page.locator(selector);
      const count = await events.count();
      
      for (let i = 0; i < count; i++) {
        const event = events.nth(i);
        
        try {
          const title = await event.locator('.event-name, .calendar-event-title').textContent();
          const course = await event.locator('.course-name, .calendar-event-course').textContent();
          const dateStr = await event.locator('.event-time, .calendar-event-time').textContent();
          
          if (title) {
            assignments.push({
              id: `cal-${i}`,
              title: title.trim(),
              course: course?.trim() || 'Unknown Course',
              dueDate: this.parseDate(dateStr || ''),
              description: '',
              submissionStatus: 'pending',
              link: `${this.baseUrl}/calendar/view.php`
            });
          }
        } catch (e) {
          // Skip this event if parsing fails
        }
      }
      
      if (assignments.length > 0) break;
    }
    
    return assignments;
  }

  /**
   * Parse assignments from dashboard timeline
   */
  private async parseDashboardAssignments(): Promise<Assignment[]> {
    if (!this.page) return [];

    const assignments: Assignment[] = [];
    
    // Look for timeline or upcoming events
    await this.page.waitForTimeout(2000);
    
    const timelineSelectors = [
      '[data-region="timeline-view"]',
      '.block_timeline',
      '[data-region="timeline"]'
    ];
    
    for (const selector of timelineSelectors) {
      if (await this.page.locator(selector).count() > 0) {
        const events = this.page.locator(`${selector} .event, ${selector} .timeline-event`);
        const count = await events.count();
        
        for (let i = 0; i < count; i++) {
          const event = events.nth(i);
          
          try {
            const title = await event.locator('.event-name, a').first().textContent();
            const course = await event.locator('.event-course').textContent();
            const link = await event.locator('a').first().getAttribute('href');
            
            if (title && title.toLowerCase().includes('assignment')) {
              assignments.push({
                id: `timeline-${i}`,
                title: title.trim(),
                course: course?.trim() || 'Unknown Course',
                dueDate: null,
                description: '',
                submissionStatus: 'pending',
                link: link ? `${this.baseUrl}${link}` : `${this.baseUrl}/my/`
              });
            }
          } catch (e) {
            // Skip this event
          }
        }
        
        if (assignments.length > 0) break;
      }
    }
    
    return assignments;
  }

  /**
   * Get assignments for a specific course
   */
  private async getCourseAssignments(course: Course): Promise<Assignment[]> {
    if (!this.page) return [];

    try {
      await this.page.goto(course.link, { 
        timeout: 10000,
        waitUntil: 'domcontentloaded' 
      });
      
      const assignments: Assignment[] = [];
      
      // Look for assignment activities
      const assignmentLinks = this.page.locator('a[href*="assign/view.php"], .activity.assign a');
      const count = await assignmentLinks.count();
      
      for (let i = 0; i < count; i++) {
        const link = assignmentLinks.nth(i);
        const title = await link.textContent();
        const href = await link.getAttribute('href');
        
        if (title && href) {
          assignments.push({
            id: `${course.id}-${i}`,
            title: title.trim(),
            course: course.name,
            dueDate: null,
            description: '',
            submissionStatus: 'pending',
            link: href.startsWith('http') ? href : `${this.baseUrl}${href}`
          });
        }
      }
      
      return assignments;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get grades/gradebook
   */
  async getGrades(): Promise<Grade[]> {
    if (!this.page || !this.isLoggedIn) {
      throw new Error('Not logged in to Moodle');
    }

    try {
      // Navigate to gradebook
      await this.page.goto(`${this.baseUrl}/grade/report/user/`, { 
        timeout: 15000,
        waitUntil: 'domcontentloaded' 
      });
      
      const grades: Grade[] = [];
      
      // Wait for grades to load
      await this.page.waitForTimeout(2000);
      
      // Try different selectors for grade tables
      const gradeSelectors = [
        '.gradeparent tr',
        '.user-grade tr',
        'table.grades tr'
      ];
      
      for (const selector of gradeSelectors) {
        const rows = this.page.locator(selector);
        const count = await rows.count();
        
        for (let i = 1; i < count; i++) { // Skip header row
          const row = rows.nth(i);
          
          try {
            const cells = row.locator('td, th');
            const cellCount = await cells.count();
            
            if (cellCount >= 3) {
              const course = await cells.nth(0).textContent();
              const assignment = await cells.nth(1).textContent();
              const grade = await cells.nth(2).textContent();
              
              if (course && assignment && grade) {
                grades.push({
                  id: `grade-${i}`,
                  course: course.trim(),
                  assignment: assignment.trim(),
                  grade: grade.trim(),
                  maxGrade: '100',
                  percentage: this.parseGradePercentage(grade.trim()),
                  feedback: '',
                  gradedDate: null
                });
              }
            }
          } catch (e) {
            // Skip this row
          }
        }
        
        if (grades.length > 0) break;
      }
      
      return grades;
    } catch (error) {
      throw new Error(`Failed to get grades: ${error}`);
    }
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    try {
      // Handle various date formats
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Parse grade percentage
   */
  private parseGradePercentage(gradeStr: string): number | null {
    try {
      const match = gradeStr.match(/(\d+(?:\.\d+)?)\s*[%\/]/);
      return match ? parseFloat(match[1]) : null;
    } catch {
      return null;
    }
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      console.warn('Error during cleanup:', error);
    } finally {
      this.isLoggedIn = false;
    }
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.browser !== null && this.page !== null && this.isLoggedIn;
  }
}

/**
 * Utility function to get LMS data with error handling
 */
export async function getLMSData(credentials: MoodleCredentials): Promise<{
  assignments: Assignment[];
  grades: Grade[];
  courses: Course[];
}> {
  const client = new MoodleClient();
  
  try {
    await client.initialize(credentials, true); // headless mode
    
    const [assignments, grades, courses] = await Promise.allSettled([
      client.getAssignments(),
      client.getGrades(),
      client.getCourses()
    ]);
    
    return {
      assignments: assignments.status === 'fulfilled' ? assignments.value : [],
      grades: grades.status === 'fulfilled' ? grades.value : [],
      courses: courses.status === 'fulfilled' ? courses.value : []
    };
  } catch (error) {
    throw error;
  } finally {
    await client.cleanup();
  }
}
