import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PeopleQueryDto } from './people-query.dto';

// Mirrors how the global ValidationPipe (transform: true) builds the DTO.
function build(query: Record<string, unknown>): PeopleQueryDto {
  return plainToInstance(PeopleQueryDto, query);
}

describe('PeopleQueryDto — ids parsing', () => {
  it('splits a comma-separated list into numbers', () => {
    const dto = build({ ids: '287,500,1245' });

    expect(dto.ids).toEqual([287, 500, 1245]);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('accepts the repeated-param array form', () => {
    const dto = build({ ids: ['287', '500'] });

    expect(dto.ids).toEqual([287, 500]);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('tolerates padding and blank entries around the separators', () => {
    const dto = build({ ids: ' 287 , ,500, ' });

    expect(dto.ids).toEqual([287, 500]);
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects non-numeric ids', () => {
    const errors = validateSync(build({ ids: 'brad,pitt' }));

    expect(errors[0].constraints).toHaveProperty('isInt');
  });

  it('rejects fractional ids', () => {
    expect(validateSync(build({ ids: '287.5' }))).not.toHaveLength(0);
  });

  it('rejects an empty list', () => {
    const errors = validateSync(build({ ids: '' }));

    expect(errors[0].constraints).toHaveProperty('arrayMinSize');
  });

  it('rejects a missing ids param', () => {
    expect(validateSync(build({}))).not.toHaveLength(0);
  });

  it('accepts the maximum batch size', () => {
    const ids = Array.from({ length: 50 }, (_, index) => index + 1);

    expect(validateSync(build({ ids: ids.join(',') }))).toHaveLength(0);
  });

  it('rejects a batch over the maximum, capping the fan-out to TMDB', () => {
    const ids = Array.from({ length: 51 }, (_, index) => index + 1);
    const errors = validateSync(build({ ids: ids.join(',') }));

    expect(errors[0].constraints).toHaveProperty('arrayMaxSize');
  });
});
