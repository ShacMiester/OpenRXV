import { Controller, Post, Body, UseGuards, Get, Param, Delete, Query, Put } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';
import { ValuesService } from 'src/shared/services/values.service';
function isEmpty(obj) {
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            return false;
        }
    }

    return JSON.stringify(obj) === JSON.stringify({});
}
@Controller('values')
export class ValuesController {

    constructor(private elastic: ValuesService) { }
    @UseGuards(AuthGuard('jwt'))
    @Post('')
    NewUser(@Body() body: any) {
        return this.elastic.add(body);
    }

    @Get(':id')
    async  GetOneUser(@Param('id') id: string) {
        let user: any = await this.elastic.findOne(id);
        user['id'] = id;
        return user
    }
    update
    @Delete(':id')
    DeleteOneUser(@Param('id') id: string) {
        return this.elastic.delete(id);
    }
    @Put(':id')
    updateOneUser(@Param('id') id: string, @Body() body) {
        return this.elastic.update(id, body);
    }


    @Get('')
    async GetUsers(@Query() query: any) {
        let filters = null

        if (!isEmpty(query)) {
            filters = {}
            Object.keys(query).forEach(key => {
                filters[key + '.keyword'] = query[key];
            });
        }

        let users = await this.elastic.find(filters);

        users.hits.map((element: any) => {
            delete element._source.password
        })
        return users;

    }

}