<?php

declare(strict_types=1);

namespace Aaxis\Bundle\CommonBundle\Tests\Unit\Controller;

use Aaxis\Bundle\CommonBundle\Controller\GridPreferenceController;
use Aaxis\Bundle\CommonBundle\Manager\GridPreferenceManager;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Container;
use Symfony\Component\HttpFoundation\Request;

class GridPreferenceControllerTest extends TestCase
{
    private GridPreferenceManager&MockObject $manager;
    private GridPreferenceController $controller;

    protected function setUp(): void
    {
        $this->manager = $this->createMock(GridPreferenceManager::class);
        $container = new Container();
        $container->set(GridPreferenceManager::class, $this->manager);
        $this->controller = new GridPreferenceController();
        $this->controller->setContainer($container);
    }

    public function testGetReturnsTheStoredState(): void
    {
        $this->manager->expects(self::once())->method('getState')->with('flows')->willReturn(['pageSize' => 25]);

        $response = $this->controller->getAction('flows');

        self::assertSame(['state' => ['pageSize' => 25]], $this->decode($response->getContent()));
    }

    public function testGetReturnsNullStateWhenNothingIsStored(): void
    {
        $this->manager->method('getState')->willReturn(null);

        self::assertSame(['state' => null], $this->decode($this->controller->getAction('flows')->getContent()));
    }

    public function testSaveStoresTheSubmittedState(): void
    {
        $this->manager->expects(self::once())->method('saveState')->with('flows', ['pageSize' => 50]);

        $response = $this->controller->saveAction('flows', $this->jsonRequest('{"state":{"pageSize":50}}'));

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(['success' => true], $this->decode($response->getContent()));
    }

    public function testSaveTreatsAMissingOrMalformedStateAsEmpty(): void
    {
        $this->manager->expects(self::exactly(2))->method('saveState')->with('flows', []);

        $this->controller->saveAction('flows', $this->jsonRequest('{}'));
        $this->controller->saveAction('flows', $this->jsonRequest('{"state":"nonsense"}'));
    }

    /**
     * @dataProvider invalidPayloadProvider
     */
    public function testSaveRejectsPayloadsThatAreNotJsonObjects(string $body): void
    {
        $this->manager->expects(self::never())->method('saveState');

        $response = $this->controller->saveAction('flows', $this->jsonRequest($body));

        self::assertSame(400, $response->getStatusCode());
        self::assertSame(
            ['success' => false, 'message' => 'Invalid payload.'],
            $this->decode($response->getContent())
        );
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function invalidPayloadProvider(): iterable
    {
        yield 'empty body' => [''];
        yield 'not json' => ['{oops'];
        yield 'scalar json' => ['42'];
        yield 'json null' => ['null'];
    }

    public function testDeclaresTheManagerAsASubscribedService(): void
    {
        self::assertContains(GridPreferenceManager::class, GridPreferenceController::getSubscribedServices());
    }

    private function jsonRequest(string $body): Request
    {
        return new Request([], [], [], [], [], ['CONTENT_TYPE' => 'application/json'], $body);
    }

    /**
     * @return array<string, mixed>
     */
    private function decode(string|false $content): array
    {
        return json_decode((string) $content, true, 512, JSON_THROW_ON_ERROR);
    }
}
