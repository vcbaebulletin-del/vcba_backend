const ReportController = require('./src/controllers/ReportController');

async function testReportController() {
  try {
    console.log('🔧 Testing ReportController directly\n');

    const reportController = new ReportController();
    
    // Mock request and response objects
    const mockReq = {
      body: {
        month: '2024-09',
        fields: ['Announcements', 'SchoolCalendar']
      },
      user: {
        email: 'test@admin.com',
        admin_id: 1,
        role: 'admin'
      }
    };

    const mockRes = {
      status: function(code) {
        this.statusCode = code;
        console.log(`📤 Response Status: ${code}`);
        return this;
      },
      json: function(data) {
        console.log('📥 Response Data:');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.success && data.data && data.data.report) {
          const report = data.data.report;
          console.log('\n📊 Report Summary:');
          console.log('Title:', report.title);
          console.log('Announcements tallies:', report.tallies.announcements);
          console.log('School calendar tallies:', report.tallies.school_calendar);
          console.log('Total items:', report.items.length);
        }
        
        return this;
      }
    };

    console.log('📤 Calling generateMonthlyReport with mock request:');
    console.log('Request body:', JSON.stringify(mockReq.body, null, 2));

    await reportController.generateMonthlyReport(mockReq, mockRes);

  } catch (error) {
    console.error('❌ Error testing ReportController:', error.message);
    console.error(error.stack);
  }
}

testReportController();
