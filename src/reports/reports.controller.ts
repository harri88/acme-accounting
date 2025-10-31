import { Controller, Get, Post } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Reports')
@Controller('api/v1/reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) { }

  @Get()
  @ApiOperation({ summary: 'Get processing time report' })
  @ApiResponse({ status: 200, description: 'Returns the processing time report.' })
  report() {
    return {
      'accounts.csv': this.reportsService.state('accounts'),
      'yearly.csv': this.reportsService.state('yearly'),
      'fs.csv': this.reportsService.state('fs'),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Generate all reports' })
  @ApiResponse({ status: 201, description: 'All reports have been successfully generated.' })
  generate() {
    this.reportsService.generateAllReports();
    return { message: 'finished' };
  }
}
